import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage2.css';

export default function Stage2({ data, metadata, onQuote, isAllQuotesCleared }) {
  // 用于跟踪已引用的评价，防止重复引用
  const [quotedEvaluations, setQuotedEvaluations] = useState([]);
  
  // 当引用被清除时，重置引用状态
  useEffect(() => {
    if (isAllQuotesCleared) {
      setQuotedEvaluations([]);
    }
  }, [isAllQuotesCleared]);

  // 处理引用
  const handleQuote = (modelIndex, evaluation) => {
    // 生成唯一的引用ID，格式为 "modelIndex-random"，防止重复引用
    const quoteId = `${modelIndex}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 更新引用状态
    setQuotedEvaluations(prev => [...prev, quoteId]);
    
    // 调用父组件的引用处理函数
    onQuote(2, modelIndex + 1, evaluation);
  };

  // 检查评价是否已引用
  const isEvaluationQuoted = (quoteId) => {
    return quotedEvaluations.includes(quoteId);
  };

  return (
    <div className="stage2">
      <div className="stage-header">
        <h3>阶段2：模型互相评价</h3>
        <p>各模型对其他模型的回答进行评价和排名</p>
      </div>

      {/* 汇总排名 */}
      {metadata?.aggregate_rankings && metadata.aggregate_rankings.length > 0 && (
        <div className="aggregate-rankings">
          <h4>综合排名</h4>
          <div className="rankings-list">
            {metadata.aggregate_rankings.map((rank, index) => (
              <div key={index} className="ranking-item">
                <div className="ranking-position">{index + 1}</div>
                <div className="ranking-model">{rank.model}</div>
                <div className="ranking-score">
                  平均分: {rank.average_score.toFixed(2)} | 平均排名: {rank.average_rank.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 各模型的评价 */}
      <div className="stage2-evaluations">
        {data.map((evaluation, modelIndex) => (
          <div key={modelIndex} className="stage2-evaluation">
            <div className="evaluation-header">
              <h4 className="evaluator-name">
                模型 {modelIndex + 1} ({evaluation.model}) 的评价
              </h4>
            </div>

            {evaluation.error ? (
              <div className="error-message">
                {evaluation.error}
              </div>
            ) : (
              <div className="evaluation-content">
                {evaluation.ranking && evaluation.ranking.length > 0 ? (
                  <div className="rankings">
                    {evaluation.ranking.map((rank, rankIndex) => (
                      <div key={rankIndex} className="ranking">
                        <div className="rank-number">{rankIndex + 1}.</div>
                        <div className="rank-info">
                          <div className="rank-label">
                            模型 {metadata?.label_to_model[rank.label] || rank.label}
                          </div>
                          <div className="rank-reason">
                            <ReactMarkdown>{rank.reason}</ReactMarkdown>
                          </div>
                          <button 
                            className={`quote-btn ${isEvaluationQuoted(`${modelIndex}-${rankIndex}`) ? 'quoted' : ''}`}
                            onClick={() => handleQuote(modelIndex, rank.reason)}
                            disabled={isEvaluationQuoted(`${modelIndex}-${rankIndex}`)}
                            title={isEvaluationQuoted(`${modelIndex}-${rankIndex}`) ? '已引用' : '引用此评价'}
                          >
                            {isEvaluationQuoted(`${modelIndex}-${rankIndex}`) ? '已引用' : '引用'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-rankings">
                    该模型未提供评价
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}