"""LLM Council core logic."""

import asyncio
from typing import List, Dict, Any, Tuple
import random
from . import openrouter
from .config import COUNCIL_MODELS, CHAIRMAN_MODEL

async def generate_conversation_title(user_query: str) -> str:
    """
    Generate a title for the conversation based on the user query.
    
    Args:
        user_query: The initial user query
        
    Returns:
        Generated conversation title
    """
    try:
        response = await openrouter.generate_title(user_query)
        return response
    except Exception as e:
        print(f"Error generating title: {e}")
        return "New Conversation"

async def run_full_council(
    user_query: str,
    api_key: str = None,
    council_models: List[str] = None,
    chairman_model: str = None,
    history_context: str = None,
    files: List[Dict[str, Any]] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any], Dict[str, Any]]:
    """
    Run the full 3-stage LLM Council process.
    
    Args:
        user_query: The user's query
        api_key: OpenRouter API key
        council_models: List of models to use for the council
        chairman_model: Model to use for the chairman
        history_context: Optional history context from previous conversations
        files: Optional list of files with their content
        
    Returns:
        Tuple of (stage1_results, stage2_results, stage3_result, metadata)
    """
    # Use default models if none provided
    if council_models is None:
        council_models = COUNCIL_MODELS
    if chairman_model is None:
        chairman_model = CHAIRMAN_MODEL
    
    # Stage 1: Collect initial responses
    stage1_results = await stage1_collect_responses(
        user_query,
        api_key=api_key,
        council_models=council_models,
        history_context=history_context,
        files=files
    )
    
    # Stage 2: Collect rankings from each model
    stage2_results, label_to_model = await stage2_collect_rankings(
        user_query,
        stage1_results,
        api_key=api_key,
        council_models=council_models
    )
    
    # Stage 3: Synthesize final answer
    stage3_result = await stage3_synthesize_final(
        user_query,
        stage1_results,
        stage2_results,
        api_key=api_key,
        chairman_model=chairman_model
    )
    
    # Calculate aggregate rankings for metadata
    aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
    
    # Create metadata
    metadata = {
        "label_to_model": label_to_model,
        "aggregate_rankings": aggregate_rankings,
        "timestamp": "now"
    }
    
    return stage1_results, stage2_results, stage3_result, metadata

async def stage1_collect_responses(
    user_query: str,
    api_key: str = None,
    council_models: List[str] = None,
    history_context: str = None,
    files: List[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Stage 1: Collect initial responses from all council models.
    
    Args:
        user_query: The user's query
        api_key: OpenRouter API key
        council_models: List of models to use
        history_context: Optional history context
        files: Optional list of files
        
    Returns:
        List of stage 1 results
    """
    if council_models is None:
        council_models = COUNCIL_MODELS
    
    # Create tasks for each model
    tasks = []
    for model in council_models:
        task = asyncio.create_task(
            openrouter.get_model_response(
                user_query,
                model=model,
                api_key=api_key,
                history_context=history_context,
                files=files
            )
        )
        tasks.append((model, task))
    
    # Wait for all tasks to complete
    results = []
    for model, task in tasks:
        try:
            response = await task
            results.append({
                "model": model,
                "response": response,
                "error": None
            })
        except Exception as e:
            results.append({
                "model": model,
                "response": None,
                "error": str(e)
            })
    
    return results

async def stage2_collect_rankings(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    api_key: str = None,
    council_models: List[str] = None
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """
    Stage 2: Collect rankings from each model on all other models' responses.
    
    Args:
        user_query: The user's query
        stage1_results: Results from stage 1
        api_key: OpenRouter API key
        council_models: List of models to use
        
    Returns:
        Tuple of (stage2_results, label_to_model)
    """
    if council_models is None:
        council_models = COUNCIL_MODELS
    
    # Filter out any models that failed in stage 1
    successful_results = [r for r in stage1_results if r["error"] is None]
    if not successful_results:
        return [], {}
    
    # Create anonymized labels for each model (A, B, C, etc.)
    model_to_label = {}
    label_to_model = {}
    for i, result in enumerate(successful_results):
        label = chr(65 + i)  # A, B, C, ...
        model_to_label[result["model"]] = label
        label_to_model[label] = result["model"]
    
    # Create anonymized responses dict
    anonymized_responses = {}
    for result in successful_results:
        label = model_to_label[result["model"]]
        anonymized_responses[label] = result["response"]
    
    # Create tasks for each model to rank the others
    tasks = []
    for model in council_models:
        task = asyncio.create_task(
            openrouter.rank_responses(
                user_query,
                anonymized_responses,
                model=model,
                api_key=api_key
            )
        )
        tasks.append((model, task))
    
    # Wait for all tasks to complete
    results = []
    for model, task in tasks:
        try:
            ranking = await task
            results.append({
                "model": model,
                "ranking": ranking,
                "error": None
            })
        except Exception as e:
            results.append({
                "model": model,
                "ranking": None,
                "error": str(e)
            })
    
    return results, label_to_model

def calculate_aggregate_rankings(
    stage2_results: List[Dict[str, Any]],
    label_to_model: Dict[str, str]
) -> Dict[str, Any]:
    """
    Calculate aggregate rankings from all models' rankings.
    
    Args:
        stage2_results: Results from stage 2
        label_to_model: Mapping from labels to models
        
    Returns:
        Aggregate rankings
    """
    if not stage2_results or not label_to_model:
        return {}
    
    # Filter out failed rankings
    successful_rankings = [r for r in stage2_results if r["ranking"] is not None]
    if not successful_rankings:
        return {}
    
    # Create model to score mapping
    model_scores = {}
    total_rankings = len(successful_rankings)
    
    # For each ranking, calculate scores
    for ranking in successful_rankings:
        ranks = ranking["ranking"]
        if not ranks:
            continue
        
        # Higher rank (1st place) gets higher score
        max_score = len(ranks)
        for rank, entry in enumerate(ranks):
            label = entry["label"]
            model = label_to_model.get(label)
            if model:
                if model not in model_scores:
                    model_scores[model] = {
                        "total_score": 0,
                        "rankings": []
                    }
                # Calculate score: higher rank (lower index) gets higher score
                score = max_score - rank
                model_scores[model]["total_score"] += score
                model_scores[model]["rankings"].append(rank + 1)  # Convert to 1-based rank
    
    # Calculate average score and average rank for each model
    aggregate = []
    for model, data in model_scores.items():
        avg_score = data["total_score"] / total_rankings
        avg_rank = sum(data["rankings"]) / len(data["rankings"])
        aggregate.append({
            "model": model,
            "total_score": data["total_score"],
            "average_score": avg_score,
            "average_rank": avg_rank,
            "rankings_count": len(data["rankings"])
        })
    
    # Sort by average score (descending)
    aggregate.sort(key=lambda x: x["average_score"], reverse=True)
    
    return aggregate

async def stage3_synthesize_final(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]],
    api_key: str = None,
    chairman_model: str = None
) -> Dict[str, Any]:
    """
    Stage 3: Synthesize final answer from all responses and rankings.
    
    Args:
        user_query: The user's query
        stage1_results: Results from stage 1
        stage2_results: Results from stage 2
        api_key: OpenRouter API key
        chairman_model: Model to use as chairman
        
    Returns:
        Stage 3 result
    """
    if chairman_model is None:
        chairman_model = CHAIRMAN_MODEL
    
    # Filter out failed results
    successful_stage1 = [r for r in stage1_results if r["error"] is None]
    successful_stage2 = [r for r in stage2_results if r["ranking"] is not None]
    
    if not successful_stage1:
        return {
            "response": "Sorry, all models failed to generate responses.",
            "error": "No successful responses from stage 1"
        }
    
    try:
        response = await openrouter.synthesize_final_response(
            user_query,
            successful_stage1,
            successful_stage2,
            model=chairman_model,
            api_key=api_key
        )
        return {
            "response": response,
            "error": None
        }
    except Exception as e:
        return {
            "response": "Sorry, the chairman model failed to synthesize a final response.",
            "error": str(e)
        }