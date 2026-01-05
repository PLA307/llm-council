import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import { api } from '../api';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  setIsLoading,
  onUpdateConversations,
  theme,
}) {
  const [input, setInput] = useState('');
  // 使用数组存储多条引用记录，每条记录包含阶段、答案序号和内容
  const [quotedItems, setQuotedItems] = useState([]);
  // 本地加载状态，用于处理重新生成阶段3时的加载状态
  const [isRegenerating, setIsRegenerating] = useState(false);
  // 用于标记是否已清除所有引用，用于通知子组件重置引用状态
  const [isAllQuotesCleared, setIsAllQuotesCleared] = useState(false);
  // 文件上传相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]); // 支持多文件上传
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, loading, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 当对话或消息更新时，滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  // 当输入框内容变化时，自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // 处理输入变化
  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  // 处理发送消息
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 转换文件数据格式，只保留需要的信息
    const fileData = uploadedFiles.map(file => ({
      name: file.name,
      content: file.content,
      type: file.type
    }));

    // 发送消息
    await onSendMessage(input.trim(), quotedItems, fileData);

    // 重置状态
    setInput('');
    setQuotedItems([]);
    setIsAllQuotesCleared(true);
    setUploadedFiles([]);
    setUploadStatus('idle');
    setErrorMessage('');
    
    // 重置清除引用标记
    setTimeout(() => {
      setIsAllQuotesCleared(false);
    }, 100);
  };

  // 处理引用内容
  const handleQuote = (stage, answerIndex, content) => {
    console.log('DEBUG ChatInterface: handleQuote called with:', { stage, answerIndex, content });
    
    // 检查是否已经引用了相同的内容
    const isAlreadyQuoted = quotedItems.some(item => 
      item.stage === stage && item.answerIndex === answerIndex
    );
    
    if (!isAlreadyQuoted) {
      setQuotedItems(prev => [...prev, { stage, answerIndex, content }]);
    }
  };

  // 处理移除引用
  const handleRemoveQuote = (index) => {
    setQuotedItems(prev => prev.filter((_, i) => i !== index));
  };

  // 处理清除所有引用
  const handleClearAllQuotes = () => {
    setQuotedItems([]);
    setIsAllQuotesCleared(true);
    
    // 重置清除引用标记
    setTimeout(() => {
      setIsAllQuotesCleared(false);
    }, 100);
  };

  // 重新生成阶段3
  const handleRegenerateStage3 = async (msg) => {
    if (!conversation || !msg) return;
    
    // 查找消息索引
    const messageIndex = conversation.messages.indexOf(msg);
    if (messageIndex === -1) return;
    
    setIsRegenerating(true);
    try {
      // 调用API重新生成阶段3
      const result = await api.regenerateStage3(conversation.id, messageIndex);
      
      // 更新对话列表，获取最新内容
      if (onUpdateConversations) {
        await onUpdateConversations();
      }
      
      console.log('重新生成阶段3成功:', result);
    } catch (error) {
      console.error('重新生成阶段3失败:', error);
      alert('重新生成阶段3失败，请重试');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 处理文件上传（拖放）
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  // 处理文件上传（点击选择）
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  // 处理文件上传（点击上传按钮）
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 处理文件
  const processFiles = async (files) => {
    // 只处理文本文件，限制大小为1MB
    const textFiles = files.filter(file => 
      file.type.startsWith('text/') || 
      ['.md', '.txt', '.json', '.js', '.py', '.html', '.css'].includes(getFileExtension(file.name))
    );
    
    if (textFiles.length === 0) {
      setErrorMessage('请选择文本文件（.txt, .md, .json, .js, .py, .html, .css等）');
      setUploadStatus('error');
      return;
    }
    
    setUploadStatus('loading');
    setUploadProgress(0);
    
    // 读取文件内容
    const processedFiles = [];
    for (let i = 0; i < textFiles.length; i++) {
      const file = textFiles[i];
      
      // 检查文件大小
      if (file.size > 1024 * 1024) { // 1MB
        setErrorMessage(`文件 ${file.name} 超过1MB限制，已跳过`);
        setUploadStatus('error');
        continue;
      }
      
      // 读取文件内容
      const content = await readFileAsText(file);
      processedFiles.push({
        name: file.name,
        content: content,
        type: file.type,
        size: file.size
      });
      
      // 更新上传进度
      setUploadProgress(Math.round(((i + 1) / textFiles.length) * 100));
    }
    
    // 添加到已上传文件列表
    setUploadedFiles(prev => [...prev, ...processedFiles]);
    setUploadStatus('success');
    
    // 3秒后清除上传状态
    setTimeout(() => {
      setUploadStatus('idle');
      setUploadProgress(0);
    }, 3000);
  };

  // 辅助函数：获取文件扩展名
  const getFileExtension = (filename) => {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
  };

  // 辅助函数：读取文件内容
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // 移除已上传的文件
  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 取消所有文件上传
  const handleCancelAll = () => {
    setUploadedFiles([]);
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
  };

  return (
    <div className={`chat-interface ${theme}`}>
      {conversation ? (
        <>
          {/* 对话历史 */}
          <div className="chat-history">
            {/* 对话标题 */}
            <div className="chat-header">
              <h2>{conversation.title || '未命名对话'}</h2>
              <div className="chat-actions">
                {/* 这里可以添加更多操作按钮 */}
              </div>
            </div>
            
            {/* 消息列表 */}
            <div className="messages">
              {conversation.messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {/* 用户消息 */}
                  {message.role === 'user' && (
                    <div className="message-content user-message">
                      {/* 引用内容 */}
                      {message.quoted_items && message.quoted_items.length > 0 && (
                        <div className="quoted-content">
                          {message.quoted_items.map((item, i) => (
                            <div key={i} className="quoted-item">
                              <div className="quoted-header">
                                引用阶段{item.stage}答案{item.answerIndex}：
                              </div>
                              <div className="quoted-text">
                                {item.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* 消息文本 */}
                      <div className="message-text">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      
                      {/* 上传的文件 */}
                      {message.files && message.files.length > 0 && (
                        <div className="uploaded-files">
                          <h4>上传的文件：</h4>
                          <div className="file-list">
                            {message.files.map((file, i) => (
                              <div key={i} className="file-item">
                                📄 {file.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 助手消息 */}
                  {message.role === 'assistant' && (
                    <div className="message-content assistant-message">
                      {/* 阶段1：收集回答 */}
                      {message.stage1 && (
                        <Stage1 
                          data={message.stage1} 
                          onQuote={handleQuote}
                          isAllQuotesCleared={isAllQuotesCleared}
                        />
                      )}
                      
                      {/* 阶段2：互相评价 */}
                      {message.stage2 && (
                        <Stage2 
                          data={message.stage2} 
                          metadata={message.metadata}
                          onQuote={handleQuote}
                          isAllQuotesCleared={isAllQuotesCleared}
                        />
                      )}
                      
                      {/* 阶段3：最终答案 */}
                      {message.stage3 && (
                        <Stage3 
                          data={message.stage3} 
                          onQuote={handleQuote}
                          isAllQuotesCleared={isAllQuotesCleared}
                          onRegenerate={() => handleRegenerateStage3(message)}
                          isRegenerating={isRegenerating}
                        />
                      )}
                      
                      {/* 加载状态 */}
                      {(message.loading && (message.loading.stage1 || message.loading.stage2 || message.loading.stage3)) && (
                        <div className="loading-indicator">
                          <div className="loading-spinner"></div>
                          <div className="loading-text">
                            {message.loading.stage1 && '正在收集回答...'}
                            {message.loading.stage2 && '正在互相评价...'}
                            {message.loading.stage3 && '正在生成最终答案...'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* 滚动到底部的引用 */}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* 输入区域 */}
          <div 
            className={`message-input-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* 已选择的引用 */}
            {quotedItems.length > 0 && (
              <div className="selected-quotes">
                <div className="quotes-header">
                  <span>已选择的引用 ({quotedItems.length})</span>
                  <button 
                    className="clear-quotes-btn"
                    onClick={handleClearAllQuotes}
                  >
                    清除所有
                  </button>
                </div>
                <div className="quotes-list">
                  {quotedItems.map((item, index) => (
                    <div key={index} className="quote-item">
                      <div className="quote-content">
                        阶段{item.stage}答案{item.answerIndex}：{item.content.slice(0, 50)}...
                      </div>
                      <button 
                        className="remove-quote-btn"
                        onClick={() => handleRemoveQuote(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 文件上传状态 */}
            {uploadStatus !== 'idle' && (
              <div className={`upload-status ${uploadStatus}`}>
                {uploadStatus === 'loading' && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      上传中... {uploadProgress}%
                    </div>
                  </div>
                )}
                {uploadStatus === 'success' && (
                  <div className="upload-success">
                    文件上传成功！
                  </div>
                )}
                {uploadStatus === 'error' && (
                  <div className="upload-error">
                    {errorMessage || '文件上传失败'}
                  </div>
                )}
              </div>
            )}
            
            {/* 已上传的文件 */}
            {uploadedFiles.length > 0 && (
              <div className="uploaded-files-preview">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="uploaded-file-item">
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        {(file.size / 1024).toFixed(1)}KB
                      </span>
                    </div>
                    <button 
                      className="remove-file-btn"
                      onClick={() => handleRemoveFile(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button 
                  className="cancel-all-btn"
                  onClick={handleCancelAll}
                >
                  取消所有
                </button>
              </div>
            )}
            
            {/* 输入表单 */}
            <form className="message-form" onSubmit={handleSubmit}>
              <div className="input-container">
                {/* 隐藏的文件输入 */}
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  onChange={handleFileSelect}
                  accept=".txt,.md,.json,.js,.py,.html,.css"
                  style={{ display: 'none' }}
                />
                
                {/* 上传按钮 */}
                <button 
                  type="button"
                  className="upload-btn"
                  onClick={handleUploadClick}
                  title="上传文件"
                >
                  📎
                </button>
                
                {/* 文本输入框 */}
                <textarea
                  ref={textareaRef}
                  className="message-input"
                  placeholder="输入你的问题..."
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  rows={1}
                  disabled={isLoading}
                ></textarea>
                
                {/* 发送按钮 */}
                <button 
                  type="submit" 
                  className="send-btn"
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? (
                    <div className="sending-spinner"></div>
                  ) : (
                    '发送'
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>欢迎使用 LLM Council</h2>
          <p>从侧边栏创建一个新对话开始吧</p>
        </div>
      )}
    </div>
  );
}