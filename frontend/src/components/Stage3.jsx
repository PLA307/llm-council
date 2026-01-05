import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage3.css';

export default function Stage3({ finalResponse, onQuote, onRegenerateStage3, isAllQuotesCleared }) {
  const [isCopied, setIsCopied] = useState(false);
  const [isQuoted, setIsQuoted] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!finalResponse) {
    return null;
  }

  // 监听全局引用清除事件，重置当前组件的引用状态
  useEffect(() => {
    if (isAllQuotesCleared) {
      setIsQuoted(false);
    }
  }, [isAllQuotesCleared]);

  // 复制当前模型回复到剪贴板
  const handleCopy = () => {
    navigator.clipboard.writeText(finalResponse.response)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  };

  // 引用当前模型回复
  const handleQuote = () => {
    const newQuotedState = !isQuoted;
    setIsQuoted(newQuotedState);
    if (onQuote) {
      // 传递引用内容、阶段号、答案序号和新的引用状态
      onQuote(finalResponse.response, 3, 1, newQuotedState); // 默认使用答案1，因为目前没有获取答案序号的机制
    }
  };

  // 重新生成阶段3答案
  const handleRegenerate = () => {
    if (onRegenerateStage3) {
      setIsRegenerating(true);
      onRegenerateStage3()
        .finally(() => {
          setIsRegenerating(false);
        });
    }
  };

  return (
    <div className="stage stage3">
      <h3 className="stage-title">阶段 3：理事会最终答案</h3>
      <div className={`final-response ${isQuoted ? 'quoted' : ''}`}>
        <div className="chairman-label">
          主席：{finalResponse.model.split('/')[1] || finalResponse.model}
        </div>
        <div className="final-text markdown-content">
          <ReactMarkdown>{finalResponse.response}</ReactMarkdown>
        </div>
        {/* 功能按钮容器 */}
        <div className="final-response-actions">
          {/* 复制按钮 */}
          <button 
            className={`action-btn copy-btn ${isCopied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={isCopied ? '已复制' : '复制内容'}
          >
            <span className="action-icon">📋</span>
            {isCopied && <span className="action-tooltip">已复制</span>}
          </button>
          {/* 重新生成按钮 */}
          <button 
            className={`action-btn regenerate-btn ${isRegenerating ? 'regenerating' : ''}`}
            onClick={handleRegenerate}
            title={isRegenerating ? '重新生成中...' : '重新生成'}
            disabled={isRegenerating}
          >
            <span className="action-icon">🔄</span>
            {isRegenerating && <span className="action-tooltip">重新生成中...</span>}
          </button>
          {/* 引用按钮 */}
          <button 
            className={`action-btn quote-btn ${isQuoted ? 'quoted' : ''}`}
            onClick={handleQuote}
            title={isQuoted ? '取消引用' : '引用内容'}
          >
            <span className="action-icon">💬</span>
            {isQuoted && <span className="action-tooltip">已引用</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
