"""OpenRouter API client for LLM Council."""

import httpx
from typing import List, Dict, Any, Optional
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL

async def get_model_response(
    user_query: str,
    model: str = "openai/gpt-5.1",
    api_key: str = None,
    history_context: str = None,
    files: List[Dict[str, Any]] = None
) -> str:
    """
    Get a response from a specific LLM model via OpenRouter API.
    
    Args:
        user_query: The user's query
        model: The model to use
        api_key: OpenRouter API key
        history_context: Optional history context
        files: Optional list of files with their content
        
    Returns:
        The model's response
    """
    # Use default API key if none provided
    if api_key is None:
        api_key = OPENROUTER_API_KEY
    
    if api_key is None:
        raise ValueError("OpenRouter API key is required")
    
    # Build the messages array
    messages = []
    
    # Add system message
    system_prompt = "You are a helpful AI assistant. Please provide a clear and concise response to the user's query."
    messages.append({"role": "system", "content": system_prompt})
    
    # Add history context if provided
    if history_context:
        messages.append({"role": "system", "content": history_context})
    
    # Add file content if provided
    if files:
        file_content = "\n\n".join([f"File {i+1} ({file['name']}):\n{file['content']}" for i, file in enumerate(files)])
        messages.append({"role": "system", "content": f"Relevant files:\n{file_content}"})
    
    # Add user query
    messages.append({"role": "user", "content": user_query})
    
    # Make the API request
    async with httpx.AsyncClient() as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/PLA307/llm-council",
                "X-Title": "LLM Council"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1024
            }
        )
    
    # Handle response
    if response.status_code != 200:
        raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")
    
    data = response.json()
    return data["choices"][0]["message"]["content"]

async def generate_title(user_query: str, api_key: str = None) -> str:
    """
    Generate a concise title for a conversation based on the user query.
    
    Args:
        user_query: The initial user query
        api_key: OpenRouter API key
        
    Returns:
        Generated title
    """
    # Use default API key if none provided
    if api_key is None:
        api_key = OPENROUTER_API_KEY
    
    if api_key is None:
        raise ValueError("OpenRouter API key is required")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/PLA307/llm-council",
                "X-Title": "LLM Council"
            },
            json={
                "model": "openai/gpt-5.1",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a title generator. Generate a concise, descriptive title for a conversation based on the user's query. Keep it under 15 words."
                    },
                    {
                        "role": "user",
                        "content": user_query
                    }
                ],
                "temperature": 0.5,
                "max_tokens": 20
            }
        )
    
    if response.status_code != 200:
        raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")
    
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()

async def rank_responses(
    user_query: str,
    anonymized_responses: Dict[str, str],
    model: str = "openai/gpt-5.1",
    api_key: str = None
) -> List[Dict[str, Any]]:
    """
    Ask a model to rank the responses of other models.
    
    Args:
        user_query: The original user query
        anonymized_responses: Dict of label -> response
        model: The model to use for ranking
        api_key: OpenRouter API key
        
    Returns:
        List of ranked responses
    """
    # Use default API key if none provided
    if api_key is None:
        api_key = OPENROUTER_API_KEY
    
    if api_key is None:
        raise ValueError("OpenRouter API key is required")
    
    # Format responses for ranking
    responses_text = "\n\n".join([f"{label}: {response}" for label, response in anonymized_responses.items()])
    
    # 修复了这里的字符串语法问题
    messages = [
        {
            "role": "system",
            "content": "You are a helpful AI assistant tasked with ranking responses to a user query. Please analyze all responses and rank them from best to worst based on accuracy, insight, and relevance to the query. Return your ranking in JSON format with a list of objects containing 'label' and 'reason' fields."
        },
        {
            "role": "user",
            "content": f"User Query: {user_query}\n\nResponses:\n{responses_text}\n\nPlease rank these responses from best to worst. Return only JSON in this format: [{\"label\": \"A\", \"reason\": \"Explanation\"}, {\"label\": \"B\", \"reason\": \"Explanation\"}]."
        }
    ]
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/PLA307/llm-council",
                "X-Title": "LLM Council"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.5,
                "max_tokens": 500
            }
        )
    
    if response.status_code != 200:
        raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")
    
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    
    # Extract JSON from response
    import json
    try:
        ranking = json.loads(content)
        return ranking
    except json.JSONDecodeError:
        # If model didn't return valid JSON, try to parse it
        raise Exception(f"Failed to parse ranking response: {content}")

async def synthesize_final_response(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]],
    model: str = "openai/gpt-5.1",
    api_key: str = None
) -> str:
    """
    Synthesize a final response from all stage 1 responses and stage 2 rankings.
    
    Args:
        user_query: The original user query
        stage1_results: Results from stage 1
        stage2_results: Results from stage 2
        model: The chairman model to use
        api_key: OpenRouter API key
        
    Returns:
        The final synthesized response
    """
    # Use default API key if none provided
    if api_key is None:
        api_key = OPENROUTER_API_KEY
    
    if api_key is None:
        raise ValueError("OpenRouter API key is required")
    
    # Format stage 1 results
    stage1_text = "\n\n".join([f"{result['model']}: {result['response']}" for result in stage1_results])
    
    # Format stage 2 results
    stage2_text = ""
    for result in stage2_results:
        if result["ranking"]:
            stage2_text += f"\n\n{result['model']} rankings:\n"
            for rank, item in enumerate(result["ranking"]):
                stage2_text += f"{rank+1}. {item['label']}: {item['reason']}\n"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/PLA307/llm-council",
                "X-Title": "LLM Council"
            },
            json={
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are the Chairman of the LLM Council. Your role is to synthesize all the responses from the council members and their rankings into a single, comprehensive final response. Please consider all perspectives and highlight the strongest points from each response."
                    },
                    {
                        "role": "user",
                        "content": f"User Query: {user_query}\n\nCouncil Responses:\n{stage1_text}\n\nCouncil Rankings:\n{stage2_text}\n\nPlease synthesize a comprehensive final response that incorporates the best insights from all council members, considering their rankings."
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1500
            }
        )
    
    if response.status_code != 200:
        raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")
    
    data = response.json()
    return data["choices"][0]["message"]["content"]