import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage3.css';

export default function Stage3({ data, onQuote, isAllQuotesCleared, onRegenerate, isRegenerating }) {
  // 用于跟踪是否已引用最终答案
  const [isQuoted, setIsQuoted] = useState(false);
  
  // 当引用被清除时，重置引用状态
  useEffect(() => {
    if (isAllQuotesCleared) {
      setIsQuoted(false);
    }
  }, [isAllQuotesCleared]);

  // 处理引用
  const handleQuote = () => {
    if (!isQuoted) {
      // 更新引用状态
      setIsQuoted(true);
      
      // 获取答案内容的前50个字符作为预览
      const preview = data.response.length > 50 ? `${data.response.slice(0, 50)}...` : data.response;
      
      // 调用父组件的引用处理函数
      onQuote(3, 1, preview);
    }
  };

  return (
    <div className="stage3">
      <div className="stage-header">
        <h3>阶段3：最终答案</h3>
        <p>综合各模型回答和评价后的最终结果</p>
      </div>

      <div className="stage3-content">
        {data.error ? (
          <div className="error-message">
            {data.error}
          </div>
        ) : (
          <div className="final-answer">
            <ReactMarkdown>{data.response}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="stage3-actions">
        <button 
          className={`quote-btn ${isQuoted ? 'quoted' : ''}`}
          onClick={handleQuote}
          disabled={isQuoted}
          title={isQuoted ? '已引用' : '引用最终答案'}
        >
          {isQuoted ? '已引用' : '引用'}
        </button>
        
        <button 
          className="regenerate-btn"
          onClick={onRegenerate}
          disabled={isRegenerating}
          title="重新生成最终答案"
        >
          {isRegenerating ? (
            <div className="regenerating-spinner"></div>
          ) : (
            '重新生成'
          )}
        </button>
      </div>
    </div>
  );
}