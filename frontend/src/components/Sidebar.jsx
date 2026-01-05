import { useState, useEffect, useRef } from 'react';
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

  // 模拟加载配置
  useEffect(() => {
    // 从localStorage加载配置
    const savedApiKey = localStorage.getItem('openrouterApiKey') || '';
    const savedModels = JSON.parse(localStorage.getItem('selectedModels') || '[]');
    const savedChairmanModel = localStorage.getItem('chairmanModel') || '';
    
    setApiKey(savedApiKey);
    setSelectedModels(savedModels);
    setChairmanModel(savedChairmanModel);
  }, []);

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
              <h3>设置</h3>
              
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
                <input 
                  type="text" 
                  value={chairmanModel} 
                  onChange={(e) => setChairmanModel(e.target.value)}
                  placeholder="google/gemini-3-pro-preview"
                />
              </div>

              <div className="setting-group">
              <label>理事会模型（每行一个）</label>
              <textarea 
                value={selectedModels.join('\n')} 
                onChange={(e) => setSelectedModels(e.target.value.split('\n').filter(m => m.trim()))}
                placeholder="openai/gpt-5.1\ngoogle/gemini-3-pro-preview\nanthropic/claude-sonnet-4.5\nx-ai/grok-4"
                rows={4}
              />
              <div className="model-hint">
                <p className="hint-text">注意：自定义模型可能存在调用限制或不可用情况，系统会自动过滤掉无法调用的模型。</p>
                <p className="model-list">当前选择的模型：{selectedModels.length > 0 ? selectedModels.join(', ') : '无'}</p>
              </div>
            </div>

              <div className="setting-actions">
                <button className="save-btn" onClick={saveSettings}>保存设置</button>
                <button className="cancel-btn" onClick={() => setShowSettings(false)}>取消</button>
              </div>

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
