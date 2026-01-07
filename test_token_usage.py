#!/usr/bin/env python3
"""
测试脚本：比较理事会模型和常规对话的Token消耗差异
"""

import asyncio
import os
from dotenv import load_dotenv
from backend.openrouter import query_model
from backend.council import run_full_council

# 加载环境变量
load_dotenv()

async def test_regular_conversation():
    """
    测试常规对话的Token消耗
    """
    print("=== 测试常规对话 ===")
    user_query = "什么是人工智能？"
    api_key = os.getenv("OPENROUTER_API_KEY")
    
    if not api_key:
        print("错误：请在.env文件中设置OPENROUTER_API_KEY")
        return None
    
    # 构建消息
    messages = [
        {"role": "user", "content": user_query}
    ]
    
    # 调用单个模型
    response = await query_model("openai/gpt-5.1", messages, api_key)
    
    if response:
        usage = response.get("usage", {})
        print(f"常规对话Token消耗：")
        print(f"  Prompt Tokens: {usage.get('prompt_tokens', 0)}")
        print(f"  Completion Tokens: {usage.get('completion_tokens', 0)}")
        print(f"  总Tokens: {usage.get('total_tokens', 0)}")
        return usage.get('total_tokens', 0)
    else:
        print("常规对话测试失败")
        return None

async def test_council_conversation(num_models):
    """
    测试理事会模型的Token消耗
    
    Args:
        num_models: 理事会模型数量（1-4）
    """
    print(f"\n=== 测试理事会对话（{num_models}个模型）===")
    user_query = "什么是人工智能？"
    api_key = os.getenv("OPENROUTER_API_KEY")
    
    if not api_key:
        print("错误：请在.env文件中设置OPENROUTER_API_KEY")
        return None
    
    # 选择指定数量的模型
    all_models = [
        "openai/gpt-5.1",
        "google/gemini-3-pro-preview", 
        "anthropic/claude-sonnet-4.5",
        "x-ai/grok-4"
    ]
    council_models = all_models[:num_models]
    
    # 运行完整理事会流程
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        user_query,
        api_key=api_key,
        council_models=council_models,
        chairman_model="google/gemini-3-pro-preview"
    )
    
    # 获取Token消耗信息
    token_usage = metadata.get("token_usage", {})
    
    print(f"理事会对话Token消耗：")
    print(f"  总Tokens: {token_usage.get('total_tokens', 0)}")
    print(f"  Stage 1 Tokens: {token_usage.get('stage1', {}).get('total_tokens', 0)}")
    print(f"  Stage 2 Tokens: {token_usage.get('stage2', {}).get('total_tokens', 0)}")
    print(f"  Stage 3 Tokens: {token_usage.get('stage3', {}).get('total_tokens', 0)}")
    
    return token_usage.get('total_tokens', 0)

async def main():
    """
    主函数：运行所有测试
    """
    # 测试常规对话
    regular_tokens = await test_regular_conversation()
    
    if not regular_tokens:
        return
    
    # 测试不同数量的理事会模型
    for num_models in range(1, 5):
        council_tokens = await test_council_conversation(num_models)
        
        if council_tokens:
            ratio = council_tokens / regular_tokens
            print(f"  相对于常规对话的倍数：{ratio:.2f}倍")

if __name__ == "__main__":
    asyncio.run(main())
