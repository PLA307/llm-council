"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio

from . import storage
from .council import run_full_council, generate_conversation_title, stage1_collect_responses, stage2_collect_rankings, stage3_synthesize_final, calculate_aggregate_rankings

app = FastAPI(title="LLM Council API")

# Enable CORS for all origins to allow frontend access from any domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str
    quoted_items: Optional[List[Dict[str, Any]]] = None
    files: Optional[List[Dict[str, Any]]] = None
    api_key: Optional[str] = None
    council_models: Optional[List[str]] = None
    chairman_model: Optional[str] = None


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]
    client_id: Optional[str] = None


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/api/conversations", response_model=List[ConversationMetadata])
async def list_conversations(x_client_id: Optional[str] = Header(None, alias="X-Client-ID")):
    """
    List all conversations (metadata only).
    If X-Client-ID header is provided, filters by that ID.
    """
    return storage.list_conversations(client_id=x_client_id)


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(
    request: CreateConversationRequest,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID")
):
    """
    Create a new conversation.
    Associates with X-Client-ID if provided.
    """
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(conversation_id, client_id=x_client_id)
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID")
):
    """
    Get a specific conversation with all its messages.
    Verifies ownership if X-Client-ID is provided.
    """
    conversation = storage.get_conversation(conversation_id, client_id=x_client_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(
    conversation_id: str, 
    request: SendMessageRequest,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID")
):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, client_id=x_client_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    # Get previous context from all assistant messages if they exist
    history_context = None
    
    # 确保有足够的消息（至少一条用户消息和一条助手消息）
    if len(conversation["messages"]) >= 2:
        # 构建完整的历史对话上下文
        history_parts = []
        
        # 遍历所有消息，构建完整对话历史
        for i in range(1, len(conversation["messages"]), 2):  # 从索引1开始，步长2，假设顺序是用户-助手-用户-助手...
            if i < len(conversation["messages"]):
                user_msg = conversation["messages"][i-1] if (i-1) >= 0 else None
                assistant_msg = conversation["messages"][i]
                
                if user_msg and assistant_msg and user_msg["role"] == "user" and assistant_msg["role"] == "assistant" and assistant_msg.get("stage3"):
                    # 构建引用内容
                    quoted_content = ""
                    if user_msg.get("quoted_items"):
                        quoted_items = user_msg["quoted_items"]
                        for item in quoted_items:
                            quoted_content += f"引用阶段{item['stage']}答案{item['answerIndex']}: {item['content']}\n"
                    
                    # 构建该轮对话
                    user_question = user_msg["content"]
                    assistant_answer = assistant_msg["stage3"].get("response", "")
                    
                    if quoted_content:
                        history_parts.append(f"{quoted_content}用户询问: {user_question}\n理事会回答: {assistant_answer}")
                    else:
                        history_parts.append(f"用户询问: {user_question}\n理事会回答: {assistant_answer}")
        
        # 如果有历史对话，将它们组合起来
        if history_parts:
            history_context = "\n\n".join(history_parts)
            history_context = f"""
=== 历史对话上下文 ===
{history_context}
=== 历史对话结束 ===
"""
            
            print(f"DEBUG: 成功提取历史上下文")
            print(f"DEBUG: 用户问题: {user_question}")
            print(f"DEBUG: 助手回答: {assistant_answer[:100]}...")
            print(f"DEBUG: 完整历史上下文: {history_context[:200]}...")
        else:
            print(f"DEBUG: 没有找到匹配的助手消息和用户消息")
            print(f"DEBUG: 消息数量: {len(conversation['messages'])}")
            print(f"DEBUG: 消息列表: {conversation['messages']}")
    else:
        print(f"DEBUG: 消息数量不足，无法提取上下文")
        print(f"DEBUG: 当前消息数量: {len(conversation['messages'])}")
        print(f"DEBUG: 消息列表: {conversation['messages']}")

    # Add user message after extracting context with quoted items if available
    storage.add_user_message(conversation_id, request.content, request.quoted_items, request.files)

    # If this is the first message, generate a title
    if is_first_message:
        title = await generate_conversation_title(request.content, request.api_key)
        storage.update_conversation_title(conversation_id, title)
    
    # Run the 3-stage council process with optional config, history context and files
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        request.content,
        api_key=request.api_key,
        council_models=request.council_models,
        chairman_model=request.chairman_model,
        history_context=history_context,
        files=request.files
    )

    # Add assistant message with all stages
    storage.add_assistant_message(
        conversation_id,
        stage1_results,
        stage2_results,
        stage3_result
    )

    # Return the complete response with metadata
    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata
    }


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(
    conversation_id: str, 
    request: SendMessageRequest,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID")
):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    print(f"DEBUG Backend: 收到消息流请求，文件数据: {request.files}")
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, client_id=x_client_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        try:
            # Get previous context from all assistant messages if they exist
            history_context = None
            
            # 确保有足够的消息（至少一条用户消息和一条助手消息）
            if len(conversation["messages"]) >= 2:
                # 构建完整的历史对话上下文
                history_parts = []
                
                # 遍历所有消息，构建完整对话历史
                for i in range(1, len(conversation["messages"]), 2):  # 从索引1开始，步长2，假设顺序是用户-助手-用户-助手...
                    if i < len(conversation["messages"]):
                        user_msg = conversation["messages"][i-1] if (i-1) >= 0 else None
                        assistant_msg = conversation["messages"][i]
                        
                        if user_msg and assistant_msg and user_msg["role"] == "user" and assistant_msg["role"] == "assistant" and assistant_msg.get("stage3"):
                            # 构建引用内容
                            quoted_content = ""
                            if user_msg.get("quoted_items"):
                                quoted_items = user_msg["quoted_items"]
                                for item in quoted_items:
                                    quoted_content += f"引用阶段{item['stage']}答案{item['answerIndex']}: {item['content']}\n"
                            
                            # 构建该轮对话
                            user_question = user_msg["content"]
                            assistant_answer = assistant_msg["stage3"].get("response", "")
                            
                            if quoted_content:
                                history_parts.append(f"{quoted_content}用户询问: {user_question}\n理事会回答: {assistant_answer}")
                            else:
                                history_parts.append(f"用户询问: {user_question}\n理事会回答: {assistant_answer}")
                
                # 如果有历史对话，将它们组合起来
                if history_parts:
                    history_context = "\n\n".join(history_parts)
                    history_context = f"""
=== 历史对话上下文 ===
{history_context}
=== 历史对话结束 ===
"""
                    
                    print(f"DEBUG STREAM: 成功提取历史上下文")
                    print(f"DEBUG STREAM: 用户问题: {user_question}")
                    print(f"DEBUG STREAM: 助手回答: {assistant_answer[:100]}...")
                    print(f"DEBUG STREAM: 完整历史上下文: {history_context[:200]}...")
                else:
                    print(f"DEBUG STREAM: 没有找到匹配的助手消息和用户消息")
                    print(f"DEBUG STREAM: 消息数量: {len(conversation['messages'])}")
            else:
                print(f"DEBUG STREAM: 消息数量不足，无法提取上下文")
                print(f"DEBUG STREAM: 当前消息数量: {len(conversation['messages'])}")

            # Add user message after extracting context with quoted items if available
            storage.add_user_message(conversation_id, request.content, request.quoted_items, request.files)

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(request.content, request.api_key))

            # Stage 1: Collect responses with history context and files
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(
                request.content,
                api_key=request.api_key,
                council_models=request.council_models,
                history_context=history_context,
                files=request.files
            )
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(
                request.content,
                stage1_results,
                api_key=request.api_key,
                council_models=request.council_models
            )
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(
                request.content,
                stage1_results,
                stage2_results,
                api_key=request.api_key,
                chairman_model=request.chairman_model
            )
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                storage.update_conversation_title(conversation_id, title)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Save complete assistant message
            storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result
            )

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: str,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID")
):
    """
    Delete a conversation.
    """
    # Verify ownership before deletion
    conversation = storage.get_conversation(conversation_id, client_id=x_client_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    success = storage.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "success", "message": "Conversation deleted successfully"}


@app.put("/api/conversations/{conversation_id}/title")
async def update_conversation_title_endpoint(
    conversation_id: str, 
    request: dict,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID")
):
    """
    Update the title of a conversation.
    """
    # Check if conversation exists and check ownership
    conversation = storage.get_conversation(conversation_id, client_id=x_client_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Update title
    title = request.get("title", "")
    storage.update_conversation_title(conversation_id, title)
    
    return {"status": "success", "message": "Conversation title updated successfully", "title": title}


@app.put("/api/conversations/{conversation_id}/messages/{message_index}/regenerate-stage3")
async def regenerate_stage3_endpoint(
    conversation_id: str, 
    message_index: int, 
    request: dict,
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID")
):
    """
    Regenerate stage 3 result for a specific message.
    """
    # Check if conversation exists and check ownership
    conversation = storage.get_conversation(conversation_id, client_id=x_client_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if message index is valid
    messages = conversation.get("messages", [])
    if message_index < 0 or message_index >= len(messages):
        raise HTTPException(status_code=404, detail="Message not found")
    
    message = messages[message_index]
    
    # Check if message is an assistant message with stage1 and stage2 results
    if message.get("role") != "assistant" or not message.get("stage1") or not message.get("stage2"):
        raise HTTPException(status_code=400, detail="Cannot regenerate stage3 for this message")
    
    # Get necessary parameters
    api_key = request.get("api_key")
    chairman_model = request.get("chairman_model")
    user_query = ""
    
    # Find the corresponding user message
    if message_index > 0 and messages[message_index - 1].get("role") == "user":
        user_query = messages[message_index - 1].get("content", "")
    
    # Regenerate stage3
    stage1_results = message["stage1"]
    stage2_results = message["stage2"]
    
    # Call stage3_synthesize_final function
    stage3_result = await stage3_synthesize_final(
        user_query,
        stage1_results,
        stage2_results,
        api_key=api_key,
        chairman_model=chairman_model
    )
    
    # Update message with new stage3 result
    message["stage3"] = stage3_result
    storage.save_conversation(conversation)
    
    return {
        "status": "success", 
        "message": "Stage3 regenerated successfully", 
        "stage3_result": stage3_result
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
