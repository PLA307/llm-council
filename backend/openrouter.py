"""OpenRouter API client for LLM Council."""

import httpx
from typing import List, Dict, Any, Optional, Tuple
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL

async def query_model(
    model: str,
    messages: List[Dict[str, Any]],
    api_key: str = None,
    timeout: float = 60.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model with the provided messages.
    
    Args:
        model: The model to query
        messages: List of messages in the conversation
        api_key: OpenRouter API key
        timeout: Request timeout in seconds
        
    Returns:
        Dict with 'content' key containing the model's response, or None if failed
    """
    if api_key is None:
        api_key = OPENROUTER_API_KEY
    
    if api_key is None:
        raise ValueError("OpenRouter API key is required")
    
    # Clean model name - remove any duplicated parts (e.g., google/google/gemini...)
    if "/" in model:
        parts = model.split("/")
        # If the first part is repeated, remove one (e.g., google/google -> google)
        if len(parts) >= 2 and parts[0] == parts[1]:
            model = "/".join(parts[1:])
    
    try:
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
                    "max_tokens": 30000,  # Increased to 30000
                    "timeout": timeout
                },
                timeout=timeout
            )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "content": data["choices"][0]["message"]["content"]
            }
        else:
            print(f"Error querying {model}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Exception querying {model}: {str(e)}")
        return None

async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, Any]],
    api_key: str = None
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel with the same messages.
    
    Args:
        models: List of models to query
        messages: List of messages in the conversation
        api_key: OpenRouter API key
        
    Returns:
        Dict mapping model names to their responses (or None if failed)
    """
    results = {}
    
    # Create all tasks
    tasks = []
    for model in models:
        task = query_model(model, messages, api_key)
        tasks.append((model, task))
    
    # Wait for all tasks to complete
    for model, task in tasks:
        results[model] = await task
    
    return results

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
    response = await query_model(model, messages, api_key)
    
    return response["content"] if response else "Error: No response from model"

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
    
    messages = [
        {
            "role": "system",
            "content": "You are a title generator. Generate a concise, descriptive title for a conversation based on the user's query. Keep it under 15 words."
        },
        {
            "role": "user",
            "content": user_query
        }
    ]
    
    response = await query_model("openai/gpt-5.1", messages, api_key)
    
    return response["content"].strip() if response else "New Conversation"

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
    
    # Build messages with a clear system prompt
    messages = [
        {
            "role": "system",
            "content": "You are a helpful AI assistant tasked with ranking responses to a user query. Please analyze all responses and rank them from best to worst based on accuracy, insight, and relevance to the query. Return your ranking in JSON format with a list of objects containing 'label' and 'reason' fields."
        },
        {
            "role": "user",
            "content": "User Query: " + user_query + "\n\nResponses:\n" + responses_text + "\n\nPlease rank these responses from best to worst. Return only JSON in this format: [{\"label\": \"A\", \"reason\": \"Explanation\"}, {\"label\": \"B\", \"reason\": \"Explanation\"}]."
        }
    ]
    
    response = await query_model(model, messages, api_key)
    
    if not response:
        return []
    
    import json
    try:
        ranking = json.loads(response["content"])
        return ranking
    except json.JSONDecodeError:
        # If model didn't return valid JSON, try to parse it
        raise Exception(f"Failed to parse ranking response: {response['content']}")

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
    
    # Build messages for the chairman model
    messages = [
        {
            "role": "system",
            "content": "You are the Chairman of the LLM Council. Your role is to synthesize all the responses from the council members and their rankings into a single, comprehensive final response. Please consider all perspectives and highlight the strongest points from each response."
        },
        {
            "role": "user",
            "content": "User Query: " + user_query + "\n\nCouncil Responses:\n" + stage1_text + "\n\nCouncil Rankings:\n" + stage2_text + "\n\nPlease synthesize a comprehensive final response that incorporates the best insights from all council members, considering their rankings."
        }
    ]
    
    response = await query_model(model, messages, api_key)
    
    return response["content"] if response else "Error: No final response generated"