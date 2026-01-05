# LLM Council 项目规则 (Project Rules)

本文档旨在规范项目开发流程、架构约定及部署维护操作，以便团队成员（包括 AI 助手）快速理解项目状态并进行高效协作。

## 1. 项目概览 (Project Overview)

**LLM Council** 是一个基于多模型协作的对话系统，通过三阶段流程（个体回复、同行评审、最终裁决）提供高质量的回答。

### 核心流程
1.  **Stage 1 (个体回复)**: 多个 LLM 模型并行生成回答。
2.  **Stage 2 (同行评审)**: 模型对其他模型的回答进行匿名评审和排名。
3.  **Stage 3 (最终裁决)**: 主席模型（Chairman）根据评审结果综合生成最终答案。

## 2. 技术栈 (Tech Stack)

### 前端 (Frontend)
*   **框架**: React 18 + Vite
*   **语言**: JavaScript (ES6+)
*   **样式**: CSS Modules + Global CSS (`index.css`)
*   **路由**: 单页应用 (SPA)，Vercel Rewrite 规则支持
*   **状态管理**: React Context / Local State
*   **Markdown渲染**: `react-markdown`

### 后端 (Backend)
*   **框架**: FastAPI (Python 3.9+)
*   **运行方式**: `uvicorn` (ASGI)
*   **API**: RESTful API + Server-Sent Events (SSE) 流式传输
*   **依赖管理**: `requirements.txt` / `pyproject.toml`

### 数据存储 (Storage)
*   **方式**: 本地 JSON 文件存储 (`data/conversations/*.json`)
*   **隔离策略**: 基于 Client ID (`X-Client-ID`) 的多租户逻辑隔离
*   **持久化**: 在 Render 等无状态云服务上，数据可能非持久化（当前作为演示版接受此限制，未来可迁移至 DB）

### 外部服务
*   **LLM API**: OpenRouter (聚合 OpenAI, Anthropic, Google 等模型)

## 3. 部署架构 (Deployment)

### 前端部署
*   **平台**: Vercel
*   **构建命令**: `npm run build`
*   **输出目录**: `dist`
*   **关键配置**: `vercel.json` (处理 SPA 路由重写)
*   **环境变量**: 
    *   `VITE_API_BASE`: 指向后端 API 地址 (如 `https://llm-council-1m97.onrender.com`)

### 后端部署
*   **平台**: Render (Free Tier)
*   **构建命令**: `pip install -r requirements.txt`
*   **启动命令**: `python -m backend.main` 或 `uvicorn backend.main:app --host 0.0.0.0 --port 10000`
*   **环境变量**:
    *   `OPENROUTER_API_KEY`: OpenRouter API 密钥
    *   `PYTHON_VERSION`: 3.9.0 (推荐)

## 4. 关键约定 (Conventions)

### 代码规范
*   **语言**: 项目文档和注释主要使用**中文**。
*   **导入**: 后端模块内部必须使用**相对导入** (如 `from . import storage`) 以支持模块化运行。
*   **端口**: 本地开发后端默认 **8001**，前端默认 **5173**。

### 身份验证与隔离
*   **Client ID**: 前端首次加载生成 UUID 存入 `localStorage` (`llm_council_client_id`)。
*   **请求头**: 所有 API 请求必须携带 `X-Client-ID` 头。
*   **后端处理**: 后端通过 `X-Client-ID` 过滤和验证数据归属，实现逻辑隔离。

### 错误处理
*   **API**: 前端 `api.js` 中需统一捕获错误并打日志。
*   **降级**: `VITE_API_BASE` 未设置时回退到 `localhost`，但需输出警告。

## 5. 常用操作指令 (Operations)

### 本地开发 (Local Development)

**启动后端**:
```bash
# 在项目根目录下
python -m backend.main
# 或使用 uvicorn 热重载
uvicorn backend.main:app --reload --port 8001
```

**启动前端**:
```bash
cd frontend
npm run dev
```

### 测试 (Testing)
*   **API 测试**: 使用 `curl` 或 Postman 测试后端端点。
*   **隔离测试**: 参考已归档的 `test_isolation.py` 逻辑，验证多 Client ID 场景。

## 6. 更新日志与维护 (Changelog & Maintenance)

*   **2026-01-05**: 
    *   修复 Vercel 部署白屏问题 (API Base URL 配置)。
    *   添加 `vercel.json` 解决 SPA 路由 404 问题。
    *   实现多设备数据隔离 (基于 Client ID)。
    *   优化 Git 提交流程，解决远程冲突。

## 7. 沟通准则 (Communication Rules)

在与 AI 助手（Trae/Claude 等）沟通时：
1.  **明确上下文**: 如果涉及特定文件，请指明路径。
2.  **优先修复**: 遇到报错优先提供错误日志。
3.  **保持风格**: 保持代码风格一致性（如 Python 类型提示，React 函数组件）。
4.  **引用规则**: 任何修改建议应遵循本文档及 `CLAUDE.md` 中的架构约定。

---
*本文档由 AI 助手整理，作为项目开发的“单一事实来源”(SSOT) 之一。*
