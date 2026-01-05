import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage1.css';

export default function Stage1({ data, onQuote, isAllQuotesCleared }) {
  // 用于跟踪已引用的答案，防止重复引用
  const [quotedAnswers, setQuotedAnswers] = useState([]);
  
  // 当引用被清除时，重置引用状态
  useEffect(() => {
    if (isAllQuotesCleared) {
      setQuotedAnswers([]);
    }
  }, [isAllQuotesCleared]);

  // 处理引用
  const handleQuote = (answerIndex, content) => {
    // 检查是否已经引用了这个答案
    if (!quotedAnswers.includes(answerIndex)) {
      // 更新引用状态
      setQuotedAnswers(prev => [...prev, answerIndex]);
      // 调用父组件的引用处理函数
      onQuote(1, answerIndex, content);
    }
  };

  // 获取答案内容的前50个字符作为预览
  const getPreview = (content) => {
    return content.length > 50 ? `${content.slice(0, 50)}...` : content;
  };

  return (
    <div className="stage1">
      <div className="stage-header">
        <h3>阶段1：各模型独立回答</h3>
        <p>以下是各模型对问题的独立回答</p>
      </div>

      <div className="stage1-answers">
        {data.map((answer, index) => (
          <div key={index} className="stage1-answer">
            <div className="answer-header">
              <h4 className="model-name">
                模型 {index + 1}: {answer.model}
              </h4>
              {answer.error ? (
                <div className="error-indicator">❌ 出错</div>
              ) : (
                <button 
                  className={`quote-btn ${quotedAnswers.includes(index + 1) ? 'quoted' : ''}`}
                  onClick={() => handleQuote(index + 1, getPreview(answer.response))}
                  disabled={quotedAnswers.includes(index + 1)}
                  title={quotedAnswers.includes(index + 1) ? '已引用' : '引用此答案'}
                >
                  {quotedAnswers.includes(index + 1) ? '已引用' : '引用'}
                </button>
              )}
            </div>

            <div className="answer-content">
              {answer.error ? (
                <div className="error-message">
                  {answer.error}
                </div>
              ) : (
                <ReactMarkdown>{answer.response}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}