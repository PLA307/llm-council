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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // 处理引用内容的回调函数
  const handleQuote = (content, stage = 3, answerIndex = 0, isQuoted = false) => {
    // 确保content是字符串，防止无效值
    if (typeof content === 'string') {
      // 检查是否已经引用了相同内容
      const existingIndex = quotedItems.findIndex(item => item.content === content);
      if (isQuoted) {
        // 如果要引用且不存在，添加新引用，最多5条
        if (existingIndex === -1) {
          const newItem = {
            id: Date.now(), // 使用时间戳作为唯一标识
            stage,
            answerIndex: answerIndex + 1, // 答案序号从1开始
            content
          };
          // 限制最多5条引用记录
          const updatedItems = [...quotedItems, newItem].slice(-5);
          setQuotedItems(updatedItems);
        }
      } else {
        // 如果要取消引用且存在，移除引用
        if (existingIndex >= 0) {
          const updatedItems = quotedItems.filter((_, index) => index !== existingIndex);
          setQuotedItems(updatedItems);
        }
      }
    }
  };

  // 清除单条引用
  const clearQuoteItem = (id) => {
    const updatedItems = quotedItems.filter(item => item.id !== id);
    setQuotedItems(updatedItems);
  };

  // 清除所有引用
  const clearAllQuotes = () => {
    setQuotedItems([]);
    // 设置清除标记，通知子组件重置引用状态
    setIsAllQuotesCleared(true);
    // 在下次渲染后重置清除标记
    setTimeout(() => {
      setIsAllQuotesCleared(false);
    }, 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 如果有输入内容、引用内容或已上传文件，且不在加载中，允许发送
    if ((input.trim() || quotedItems.length > 0 || uploadedFiles.length > 0) && !isLoading) {
      console.log('DEBUG: 准备发送消息，已上传文件数量:', uploadedFiles.length);
      // 准备要发送的文件数据
      const fileData = uploadedFiles.map(fileItem => ({
        name: fileItem.file.name,
        content: fileItem.content
      }));
      
      console.log('DEBUG: 发送的文件数据:', fileData);
      // 发送的消息包含用户输入、引用内容和文件数据
      onSendMessage(input.trim(), quotedItems, fileData);
      // 发送后清除所有引用和已上传文件
      setQuotedItems([]);
      setUploadedFiles([]);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 清除引用
  const clearQuote = () => {
    setQuotedContent(null);
  };

  // 文件拖放事件处理
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // 获取拖放的文件
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files);
    }
  };

  // 文件选择处理
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelection(files);
    }
  };

  // 触发文件选择对话框
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 文件选择处理（支持多文件）
  const handleFileSelection = (files) => {
    // 重置状态
    setErrorMessage('');
    setUploadStatus('loading');
    setUploadProgress(0);
    
    // 模拟上传进度
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 100);
    
    // 验证并处理每个文件
    const validFiles = [];
    let errorMsg = '';
    
    for (const file of files) {
      // 验证文件类型
      if (!file.name.endsWith('.md')) {
        errorMsg = `仅允许上传扩展名为.md的Markdown文件，"${file.name}" 类型无效`;
        break;
      }
      
      // 验证文件大小（10MB）
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        errorMsg = `文件大小不能超过10MB，"${file.name}" 大小：${(file.size / (1024 * 1024)).toFixed(2)}MB`;
        break;
      }
      
      // 检查文件名是否已存在
      if (!validFiles.some(f => f.name === file.name)) {
        validFiles.push(file);
      }
    }
    
    if (errorMsg) {
      clearInterval(progressInterval);
      setUploadStatus('error');
      setErrorMessage(errorMsg);
      return;
    }
    
    // 读取文件内容并保存
    const loadFiles = async () => {
      const loadedFiles = [];
      
      for (const file of validFiles) {
        const content = await readFileContent(file);
        console.log('DEBUG: 成功读取文件:', file.name, '内容长度:', content.length);
        loadedFiles.push({ file, content });
      }
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('success');
      
      // 更新已上传文件列表
      setUploadedFiles(prev => {
        const newFiles = [...prev, ...loadedFiles];
        console.log('DEBUG: 更新后的已上传文件列表:', newFiles.map(f => f.file.name));
        return newFiles;
      });
      
      // 显示上传成功提示
      setTimeout(() => {
        setUploadStatus('idle');
      }, 2000);
    };
    
    loadFiles();
  };

  // 读取文件内容
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      console.log('DEBUG: 开始读取文件:', file.name);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        console.log('DEBUG: 文件读取成功:', file.name, '内容长度:', e.target.result.length);
        resolve(e.target.result);
      };
      
      reader.onerror = (e) => {
        console.error('DEBUG: 文件读取失败:', file.name, e);
        reject(new Error('文件读取失败'));
      };
      
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

  // 重新生成阶段3答案
  const handleRegenerateStage3 = async (msg) => {
    // 显示加载状态
    setIsLoading(true);
    
    try {
      // 调用API重新生成阶段3
      // 需要获取对话ID和消息索引
      const conversationId = conversation.id;
      const messageIndex = conversation.messages.findIndex(m => m === msg);
      
      if (messageIndex === -1) {
        throw new Error('消息未找到');
      }
      
      // 调用API重新生成阶段3
      const result = await api.regenerateStage3(conversationId, messageIndex);
      
      // 更新对话状态
      // 重新加载对话以获取更新后的内容
      await onUpdateConversations();
      
      console.log('重新生成阶段3成功:', result);
      
    } catch (error) {
      console.error('重新生成阶段3失败:', error);
      alert('重新生成阶段3失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>欢迎使用 LLM 理事会</h2>
          <p>创建新对话开始使用</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      {/* 悬浮汉堡菜单导航 */}
      <div className="floating-nav">
        <div className="nav-icon">
          <div className="nav-lines"></div>
          <div className="nav-tooltip">
            <div className="nav-items">
              {/* 阶段 1 主菜单项 */}
              <div className="nav-item main-nav-item">
                <span className="nav-item-title">阶段 1</span>
                <div className="nav-item-tooltip">
                  <div className="tooltip-content">
                    <h4>阶段 1: 个体回复</h4>
                    <p>收集各个模型的独立回复</p>
                  </div>
                </div>
                {/* 阶段 1 子菜单 */}
                <div className="nav-subitems">
                  {conversation.messages
                    .filter(msg => msg.role === 'assistant' && msg.stage1)
                    .map((msg, msgIndex) => (
                      <div 
                        key={`stage1-${msgIndex}`}
                        className="nav-subitem"
                        onClick={() => {
                          // 查找对应消息的stage1元素
                          const assistantMessages = document.querySelectorAll('.assistant-message');
                          assistantMessages.forEach((elem, index) => {
                            if (index === msgIndex) {
                              const stage1Element = elem.querySelector('.stage1');
                              if (stage1Element) {
                                stage1Element.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                  inline: 'nearest'
                                });
                              }
                            }
                          });
                        }}
                      >
                        <span className="nav-subitem-title">回复 {msgIndex + 1}</span>
                        <div className="nav-subitem-tooltip">
                          <div className="tooltip-content">
                            <h4>阶段 1 回复 {msgIndex + 1}</h4>
                            <p>查看第{msgIndex + 1}条个体回复</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* 阶段 2 主菜单项 */}
              <div className="nav-item main-nav-item">
                <span className="nav-item-title">阶段 2</span>
                <div className="nav-item-tooltip">
                  <div className="tooltip-content">
                    <h4>阶段 2: 同伴排名</h4>
                    <p>模型之间互相评估和排名</p>
                  </div>
                </div>
                {/* 阶段 2 子菜单 */}
                <div className="nav-subitems">
                  {conversation.messages
                    .filter(msg => msg.role === 'assistant' && msg.stage2)
                    .map((msg, msgIndex) => (
                      <div 
                        key={`stage2-${msgIndex}`}
                        className="nav-subitem"
                        onClick={() => {
                          // 查找对应消息的stage2元素
                          const assistantMessages = document.querySelectorAll('.assistant-message');
                          assistantMessages.forEach((elem, index) => {
                            if (index === msgIndex) {
                              const stage2Element = elem.querySelector('.stage2');
                              if (stage2Element) {
                                stage2Element.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                  inline: 'nearest'
                                });
                              }
                            }
                          });
                        }}
                      >
                        <span className="nav-subitem-title">排名 {msgIndex + 1}</span>
                        <div className="nav-subitem-tooltip">
                          <div className="tooltip-content">
                            <h4>阶段 2 排名 {msgIndex + 1}</h4>
                            <p>查看第{msgIndex + 1}条同伴排名</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* 阶段 3 主菜单项 */}
              <div className="nav-item main-nav-item">
                <span className="nav-item-title">阶段 3</span>
                <div className="nav-item-tooltip">
                  <div className="tooltip-content">
                    <h4>阶段 3: 最终答案</h4>
                    <p>综合各模型回复，生成最终答案</p>
                  </div>
                </div>
                {/* 阶段 3 子菜单 */}
                <div className="nav-subitems">
                  {conversation.messages
                    .filter(msg => msg.role === 'assistant' && msg.stage3)
                    .map((msg, msgIndex) => (
                      <div 
                        key={`stage3-${msgIndex}`}
                        className="nav-subitem"
                        onClick={() => {
                          // 查找对应消息的stage3元素
                          const assistantMessages = document.querySelectorAll('.assistant-message');
                          assistantMessages.forEach((elem, index) => {
                            if (index === msgIndex) {
                              const stage3Element = elem.querySelector('.stage3');
                              if (stage3Element) {
                                stage3Element.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                  inline: 'nearest'
                                });
                              }
                            }
                          });
                        }}
                      >
                        <span className="nav-subitem-title">答案 {msgIndex + 1}</span>
                        <div className="nav-subitem-tooltip">
                          <div className="tooltip-content">
                            <h4>阶段 3 答案 {msgIndex + 1}</h4>
                            <p>查看第{msgIndex + 1}条最终答案</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <h2>开始对话</h2>
            <p>提问以咨询 LLM 理事会</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">你</div>
                  <div className="message-content">
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">LLM 理事会</div>

                  {/* Stage 1 */}
                  {msg.loading?.stage1 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>运行阶段 1：收集个体回复...</span>
                    </div>
                  )}
                  {msg.stage1 && <Stage1 responses={msg.stage1} />}

                  {/* Stage 2 */}
                  {msg.loading?.stage2 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>运行阶段 2：同伴排名...</span>
                    </div>
                  )}
                  {msg.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                    />
                  )}

                  {/* 阶段 3 */}
                  {msg.loading?.stage3 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>运行阶段 3：最终综合...</span>
                    </div>
                  )}
                  {msg.stage3 && <Stage3 
                    finalResponse={msg.stage3} 
                    onQuote={handleQuote} 
                    onRegenerateStage3={() => handleRegenerateStage3(msg)} 
                    isAllQuotesCleared={isAllQuotesCleared} 
                  />}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>正在咨询理事会...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        {/* 引用状态指示 */}
        {quotedItems.length > 0 && (
          <div className="quoted-indicator">
            <div className="quoted-header">
              <div className="quoted-icon">💬</div>
              <div className="quoted-title">引用记录</div>
              <button 
                className="clear-all-quotes-btn"
                onClick={clearAllQuotes}
                title="清除所有引用"
              >
                清除所有
              </button>
            </div>
            <div className="quoted-list">
              {quotedItems.map((item) => (
                <div key={item.id} className="quoted-item">
                  <div className="quoted-marker">引用阶段{item.stage}答案{item.answerIndex}</div>
                  <div className="quoted-preview">
                    {item.content.length > 5 ? `${item.content.substring(0, 5)}...` : item.content}
                  </div>
                  <button 
                    className="clear-quote-item-btn"
                    onClick={() => clearQuoteItem(item.id)}
                    title="清除该引用"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 文件上传区域 */}
        {/* 隐藏的文件输入框，支持多文件选择 */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept=".md"
          multiple
        />
        
        {/* 已上传文件列表 - 简化显示，移除插入按钮 */}
        {uploadedFiles.length > 0 && (
          <div className="uploaded-files-list">
            <div className="uploaded-files-header">
              <span className="files-title">已上传文件 ({uploadedFiles.length})</span>
              <button 
                type="button"
                className="clear-all-btn"
                onClick={handleCancelAll}
                title="清除所有文件"
              >
                清除所有
              </button>
            </div>

            <div className="files-container">
              {uploadedFiles.map((fileItem, index) => (
                <div key={index} className="file-item">
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <span className="file-number">文件{index + 1}:</span>
                    <span className="file-name">{fileItem.file.name}</span>
                    <span className="file-size">{(fileItem.file.size / 1024).toFixed(2)} KB</span>
                  </div>
                  <div className="file-actions">
                    <button 
                      type="button"
                      className="remove-file-btn"
                      onClick={() => handleRemoveFile(index)}
                      title="移除文件"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 上传状态反馈 */}
        {uploadStatus === 'loading' && (
          <div className="upload-status loading">
            <div className="spinner"></div>
            <div className="status-content">
              <div className="status-text">正在上传...</div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="progress-text">{uploadProgress}%</div>
            </div>
          </div>
        )}
        
        {uploadStatus === 'success' && (
          <div className="upload-status success">
            <div className="success-icon">✅</div>
            <div className="success-message">文件上传成功！</div>
          </div>
        )}
        
        {uploadStatus === 'error' && errorMessage && (
          <div className="upload-status error">
            <div className="error-icon">❌</div>
            <div className="error-message">{errorMessage}</div>
            <button 
              type="button"
              className="retry-btn"
              onClick={handleCancelAll}
            >
              重试
            </button>
          </div>
        )}
        
        <div className="input-area">
          <textarea
            ref={textareaRef}
            className={`message-input ${quotedItems.length > 0 ? 'has-quoted' : ''}`}
            placeholder="提出你的问题... (Shift+Enter 换行，Enter 发送)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={3}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
          
          <div className="send-upload-container">
            {/* 拖放区域 - 圆形样式 */}
            <div 
              className={`upload-area circular ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              title="拖放Markdown文件到此处或点击选择文件"
            >
              <div className="upload-icon">📁</div>
            </div>
            
            <button
              type="submit"
              className="send-button circular"
              disabled={!(input.trim() || quotedItems.length > 0 || uploadedFiles.length > 0) || isLoading}
              title="发送消息"
            >
              ➤
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
