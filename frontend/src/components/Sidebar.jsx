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
  const editInputRef = useRef(null);

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

  // 处理编辑标题的键盘事件
  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      saveEditedTitle(id);
    } else if (e.key === 'Escape') {
      cancelEditTitle();
    }
  };

  // 处理删除对话
  const handleDeleteConversation = async (id) => {
    if (window.confirm('确定要删除这个对话吗？')) {
      try {
        await api.deleteConversation(id);
        // 更新对话列表
        if (onUpdateConversations) {
          onUpdateConversations();
        }
        console.log('对话删除成功:', id);
      } catch (error) {
        console.error('删除对话失败:', error);
        alert('删除对话失败，请重试');
      }
    }
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${theme}`}>
      {/* 侧边栏顶部 */}
      <div className="sidebar-header">
        <h1 className="sidebar-title">
          LLM Council
        </h1>
        <div className="header-actions">
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
              <li>主席模型：负责综合所有模型的回答，生成最终结果</li>
              <li>理事会模型：参与回答和互相评价的模型列表</li>
              <li>您可以根据需要添加或删除模型</li>
            </ul>
          </div>
        </div>
      )}

      {/* 对话列表 */}
      <div className="conversations-list">
        {/* 新建对话按钮 */}
        <button 
          className="new-conversation-btn" 
          onClick={onNewConversation}
        >
          + 新建对话
        </button>

        {/* 对话列表项 */}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
            onClick={() => onSelectConversation(conv.id)}
          >
            {/* 对话标题 */}
            <div className="conversation-title-container">
              {editingId === conv.id ? (
                <div className="conversation-title-edit">
                  <input
                    type="text"
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => saveEditedTitle(conv.id)}
                    onKeyDown={(e) => handleEditKeyDown(e, conv.id)}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button className="save-edit-btn" onClick={(e) => {
                      e.stopPropagation();
                      saveEditedTitle(conv.id);
                    }}>
                      保存
                    </button>
                    <button className="cancel-edit-btn" onClick={(e) => {
                      e.stopPropagation();
                      cancelEditTitle();
                    }}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="conversation-title"
                  onDoubleClick={(e) => handleDoubleClickTitle(e, conv)}
                >
                  {conv.title || '未命名对话'}
                </div>
              )}
            </div>
            
            {/* 对话元信息 */}
            <div className="conversation-meta">
              <span className="conversation-date">
                {new Date(conv.created_at).toLocaleString()}
              </span>
              <span className="message-count">
                {conv.message_count} 条消息
              </span>
              <button 
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConversation(conv.id);
                }}
                title="删除对话"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}