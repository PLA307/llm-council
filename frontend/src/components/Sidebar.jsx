import { useState, useEffect, useRef, useMemo } from 'react';
import './Sidebar.css';
import { api } from '../api';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onUpdateConversations,
  theme,
  onToggleTheme,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [chairmanModel, setChairmanModel] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false); // 侧边栏显示/隐藏状态
  const [editingId, setEditingId] = useState(null); // 当前正在编辑的对话ID
  const [editingTitle, setEditingTitle] = useState(''); // 编辑中的标题内容
  const editInputRef = useRef(null); // 编辑输入框的引用
  
  // 推荐模型列表 - 使用useMemo包装以避免每次渲染都重新创建
  const RECOMMENDED_MODELS = useMemo(() => {
    // 所有模型列表，包含原有模型和新添加的模型
    const allModels = [
      { id: "x-ai/grok-code-fast-1", name: "Grok Code Fast" },
      { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast" },
      { id: "xiaomi/mimo-v2-flash:free", name: "MiMo v2 Flash (Free)" },
      { id: "nex-agi/deepseek-v3.1-nex-n1:free", name: "DeepSeek V3.1 Nex (Free)" },
      { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
      { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro Preview" },
      { id: "z-ai/glm-4.7", name: "GLM 4.7" },
      { id: "openai/gpt-5.2", name: "GPT 5.2" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "openai/gpt-oss-120b:free", name: "GPT OSS 120B (Free)" },
      { id: "qwen/qwen3-235b-a22b-2507", name: "Qwen 3 235B" },
      { id: "qwen/qwen3-coder:free", name: "Qwen 3 Coder (Free)" },
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" }
    ];
    
    // 排序函数：先按系列分组，再按是否免费排序
    const sortModels = (models) => {
      return models.sort((a, b) => {
        // 提取模型系列（如 "openai", "google", "x-ai" 等）
        const getSeries = (modelId) => {
          const parts = modelId.split('/');
          return parts[0];
        };
        
        // 检查是否为免费模型
        const isFree = (modelId) => {
          return modelId.includes(':free');
        };
        
        // 提取模型版本
        const getVersion = (modelId) => {
          const parts = modelId.split('/')[1];
          return parts;
        };
        
        // 定义系列排序优先级
        const seriesPriority = {
          'openai': 1,
          'google': 2,
          'qwen': 3,
          'anthropic': 4,
          'deepseek': 5,
          'nex-agi': 6,
          'x-ai': 7,
          'z-ai': 8,
          'xiaomi': 9
        };
        
        const seriesA = getSeries(a.id);
        const seriesB = getSeries(b.id);
        const isFreeA = isFree(a.id);
        const isFreeB = isFree(b.id);
        
        // 先按系列优先级排序
        if (seriesPriority[seriesA] < seriesPriority[seriesB]) return -1;
        if (seriesPriority[seriesA] > seriesPriority[seriesB]) return 1;
        
        // 同系列内，先按是否免费排序（免费在前）
        if (isFreeA && !isFreeB) return -1;
        if (!isFreeA && isFreeB) return 1;
        
        // 同系列同免费状态，按模型版本排序
        return getVersion(a.id).localeCompare(getVersion(b.id));
      });
    };
    
    // 移除重复模型
    const uniqueModels = [];
    const existingIds = new Set();
    
    allModels.forEach(model => {
      if (!existingIds.has(model.id)) {
        uniqueModels.push(model);
        existingIds.add(model.id);
      }
    });
    
    // 排序后返回
    return sortModels(uniqueModels);
  }, []);

  const [customModelInput, setCustomModelInput] = useState('');
  const [selectedRecommendedModel, setSelectedRecommendedModel] = useState(RECOMMENDED_MODELS[0].id);
  
  // 主席模型相关状态
  const [selectedChairmanModel, setSelectedChairmanModel] = useState('');
  const [chairmanCustomInput, setChairmanCustomInput] = useState('');

  // 模拟加载配置
  useEffect(() => {
    // 从localStorage加载配置
    const savedApiKey = localStorage.getItem('openrouterApiKey') || '';
    const savedModels = JSON.parse(localStorage.getItem('selectedModels') || '[]');
    const savedChairmanModel = localStorage.getItem('chairmanModel') || '';
    
    setApiKey(savedApiKey);
    setSelectedModels(savedModels);
    setChairmanModel(savedChairmanModel);
    
    // 设置主席模型的选择状态
    if (savedChairmanModel) {
      // 检查是否是推荐模型列表中的模型
      const isRecommended = RECOMMENDED_MODELS.some(model => model.id === savedChairmanModel);
      setSelectedChairmanModel(isRecommended ? savedChairmanModel : 'custom');
      if (!isRecommended) {
        setChairmanCustomInput(savedChairmanModel);
      }
    } else {
      setSelectedChairmanModel(RECOMMENDED_MODELS[0].id);
    }
  }, [RECOMMENDED_MODELS]);

  // 保存配置
  const saveSettings = () => {
    localStorage.setItem('openrouterApiKey', apiKey);
    localStorage.setItem('selectedModels', JSON.stringify(selectedModels));
    localStorage.setItem('chairmanModel', chairmanModel);
    setShowSettings(false);
    // 这里可以添加通知或刷新配置
  };

  // 删除对话
  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    try {
      // 调用后端API删除对话
      await api.deleteConversation(id);
      // 更新对话列表
      if (onUpdateConversations) {
        onUpdateConversations();
      }
      // 如果删除的是当前选中的对话，清除选中状态
      if (currentConversationId === id) {
        onSelectConversation(null);
      }
      console.log('对话删除成功:', id);
    } catch (error) {
      console.error('删除对话失败:', error);
      alert('删除对话失败，请重试');
    }
  };

  // 双击触发编辑标题
  const handleDoubleClickTitle = (e, conv) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title || '');
  };

  // 保存编辑的标题
  const saveEditedTitle = async (id) => {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    
    try {
      // 调用后端API更新对话标题
      await api.updateConversationTitle(id, editingTitle.trim());
      // 更新对话列表
      if (onUpdateConversations) {
        onUpdateConversations();
      }
      setEditingId(null);
      console.log('对话标题更新成功:', id);
    } catch (error) {
      console.error('更新对话标题失败:', error);
      alert('更新对话标题失败，请重试');
    }
  };

  // 取消编辑标题
  const cancelEditTitle = () => {
    setEditingId(null);
  };

  // 处理编辑输入框的键盘事件
  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      saveEditedTitle(id);
    } else if (e.key === 'Escape') {
      cancelEditTitle();
    }
  };

  // 点击外部区域取消编辑
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (editInputRef.current && !editInputRef.current.contains(e.target)) {
        cancelEditTitle();
      }
    };

    if (editingId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingId]);

  // 添加模型
  const handleAddModel = () => {
    let modelIdToAdd = selectedRecommendedModel;
    
    // 如果选择了自定义模型选项
    if (selectedRecommendedModel === 'custom') {
      if (!customModelInput.trim()) {
        alert('请输入自定义模型ID');
        return;
      }
      modelIdToAdd = customModelInput.trim();
    }
    
    if (selectedModels.length >= 4) {
      alert('最多只能选择 4 个理事会模型');
      return;
    }
    if (selectedModels.includes(modelIdToAdd)) {
      alert('该模型已添加');
      return;
    }
    setSelectedModels([...selectedModels, modelIdToAdd]);
    setCustomModelInput(''); // 清空自定义输入
  };

  // 移除模型
  const handleRemoveModel = (modelId) => {
    setSelectedModels(selectedModels.filter(id => id !== modelId));
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && <h1>LLM 理事会</h1>}
        <div className="header-actions">
          {!isCollapsed && (
            <button className="new-conversation-btn" onClick={onNewConversation}>
              + 新对话
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="conversation-list">
            {conversations.length === 0 ? (
              <div className="no-conversations">暂无对话</div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div className="conversation-title">
                    {editingId === conv.id ? (
                      <div ref={editInputRef} className="title-edit-container">
                        <input
                          type="text"
                          className="title-edit-input"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, conv.id)}
                          onBlur={() => saveEditedTitle(conv.id)}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div 
                        className="title-text"
                        onDoubleClick={(e) => handleDoubleClickTitle(e, conv)}
                      >
                        {conv.title || '新对话'}
                      </div>
                    )}
                  </div>
                  <div className="conversation-meta">
                    {conv.message_count} 条消息
                    <div className="conversation-actions">
                      <button 
                        className="delete-btn"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 移动到对话列表下方的图标按钮 */}
          <div className="bottom-actions">
            <button 
              className="theme-toggle-btn" 
              onClick={onToggleTheme}
              title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button 
              className="settings-btn" 
              onClick={() => setShowSettings(!showSettings)}
              title="设置"
            >
              ⚙️
            </button>
            <button 
              className="toggle-sidebar-btn" 
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {isCollapsed ? '→' : '←'}
            </button>
          </div>

          {/* 设置面板 */}
          {showSettings && (
            <div className="settings-panel">
              <div className="settings-header">
                <h3>设置</h3>
                <div className="settings-actions-top">
                  <button className="cancel-btn" onClick={() => setShowSettings(false)}>取消</button>
                  <button className="save-btn" onClick={saveSettings}>保存</button>
                </div>
              </div>
              
              <div className="setting-group">
                <label>OpenRouter API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                />
              </div>

              <div className="setting-group">
                <label>主席模型</label>
                <div className="add-model-row">
                  <select 
                    className="model-select"
                    value={selectedChairmanModel}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedChairmanModel(value);
                      if (value === 'custom') {
                        // 如果选择了自定义，使用自定义输入的值
                        if (chairmanCustomInput.trim()) {
                          setChairmanModel(chairmanCustomInput.trim());
                        }
                      } else {
                        // 否则使用选择的推荐模型
                        setChairmanModel(value);
                        setChairmanCustomInput('');
                      }
                    }}
                  >
                    {RECOMMENDED_MODELS.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                    <option value="custom">📝 自定义模型</option>
                  </select>
                </div>
                
                {/* 主席模型自定义输入框 - 仅当选择自定义选项时显示 */}
                {selectedChairmanModel === 'custom' && (
                  <div className="custom-model-row">
                    <input 
                      type="text" 
                      className="custom-model-input"
                      value={chairmanCustomInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setChairmanCustomInput(value);
                        setChairmanModel(value);
                      }}
                      placeholder="google/gemini-3-pro-preview"
                    />
                  </div>
                )}
              </div>

              <div className="setting-group">
                <label>理事会模型（{selectedModels.length}/4）</label>
                
                {/* 已选模型列表 */}
                <div className="selected-models-container">
                  {selectedModels.length === 0 ? (
                    <div className="no-models-tip">请添加模型</div>
                  ) : (
                    selectedModels.map((modelId) => (
                      <div key={modelId} className="model-chip">
                        <span className="model-chip-name">
                          {RECOMMENDED_MODELS.find(m => m.id === modelId)?.name || modelId.split('/').pop()}
                        </span>
                        <button 
                          className="model-chip-remove"
                          onClick={() => handleRemoveModel(modelId)}
                          title="移除"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 添加模型 - 整合推荐列表和自定义选项 */}
                <div className="add-model-section">
                  <div className="add-model-row">
                    <select 
                      className="model-select"
                      value={selectedRecommendedModel}
                      onChange={(e) => setSelectedRecommendedModel(e.target.value)}
                      disabled={selectedModels.length >= 4}
                    >
                      {RECOMMENDED_MODELS.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                      <option value="custom">📝 自定义模型</option>
                    </select>
                    <button 
                      className="add-model-btn"
                      onClick={handleAddModel}
                      disabled={selectedModels.length >= 4}
                    >
                      添加
                    </button>
                  </div>

                  {/* 自定义模型输入框 - 仅当选择自定义选项时显示 */}
                  {selectedRecommendedModel === 'custom' && (
                    <div className="custom-model-row">
                      <input 
                        type="text" 
                        className="custom-model-input"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        placeholder="自定义模型ID (如 openai/gpt-4)"
                        disabled={selectedModels.length >= 4}
                      />
                    </div>
                  )}
                </div>

                <div className="model-hint">
                  <p className="hint-text">您可以自由组合 1-4 个模型。模型 ID 可参考 OpenRouter 列表。</p>
                  <p className="hint-text warning">⚠️ 注意：部分模型（特别是 Preview/Free 版本）可能会出现生成中断或返回空结果的情况，这通常是服务商 API 不稳定导致的。遇到此类问题建议更换模型重试。</p>
                </div>
              </div>

              {/* 底部按钮已移除，移动到了头部 */}

              <div className="setting-help">
                <h4>使用说明：</h4>
                <ul>
                  <li>获取API Key：访问 <a href="https://openrouter.ai" target="_blank">openrouter.ai</a> 注册并创建API密钥</li>
                  <li>模型列表：查看 <a href="https://openrouter.ai/models" target="_blank">OpenRouter模型列表</a> 获取可用模型名称</li>
                  <li>主席模型：负责综合最终答案，建议使用强大的模型</li>
                  <li>理事会模型：参与评估和排名，可添加多个模型</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* 折叠状态下的按钮 */}
      {isCollapsed && (
        <div className="collapsed-actions">
          <button 
            className="theme-toggle-btn" 
            onClick={onToggleTheme}
            title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button 
            className="settings-btn" 
            onClick={() => setShowSettings(!showSettings)}
            title="设置"
          >
            ⚙️
          </button>
          <button 
            className="toggle-sidebar-btn" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title="展开侧边栏"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
