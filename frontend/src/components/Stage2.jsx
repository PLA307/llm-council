import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage2.css';

function deAnonymizeText(text, labelToModel) {
  if (!labelToModel) return text;

  let result = text;
  // Replace each "Response X" with the actual model name
  Object.entries(labelToModel).forEach(([label, model]) => {
    const modelShortName = model.split('/')[1] || model;
    result = result.replace(new RegExp(label, 'g'), `**${modelShortName}**`);
  });
  return result;
}

export default function Stage2({ rankings, labelToModel, aggregateRankings }) {
  const [activeTab, setActiveTab] = useState(0);

  // 确保 rankings 存在且不为空，如果为空但正在加载（父组件控制），返回null或加载状态
  if (!rankings || rankings.length === 0) {
    return null;
  }
  
  // 确保 activeTab 索引有效，如果越界则重置为0
  // 这修复了当 rankings 更新但 activeTab 保持旧值可能导致的越界错误
  const currentTab = activeTab >= rankings.length ? 0 : activeTab;
  if (currentTab !== activeTab) {
     setActiveTab(currentTab);
  }

  return (
    <div className="stage stage2">
      <h3 className="stage-title">阶段 2：同伴排名</h3>

      <h4>原始评估</h4>
      <p className="stage-description">
        每个模型评估了所有回复（匿名化为回复 A、B、C 等）并提供了排名。
        以下是模型名称以 <strong>粗体</strong> 显示，便于阅读，但原始评估使用的是匿名标签。
      </p>

      <div className="tabs">
        {rankings.map((rank, index) => (
          <button
            key={index}
            className={`tab ${currentTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {rank.model.split('/')[1] || rank.model}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="ranking-model">
          {rankings[currentTab].model}
        </div>
        <div className="ranking-content markdown-content">
          <ReactMarkdown>
            {typeof rankings[currentTab].ranking === 'string' 
              ? deAnonymizeText(rankings[currentTab].ranking, labelToModel)
              : JSON.stringify(rankings[currentTab].ranking, null, 2)}
          </ReactMarkdown>
        </div>
      </div>

      {aggregateRankings && aggregateRankings.length > 0 && (
        <div className="aggregate-rankings">
          <h4>综合排名（可信度）</h4>
          <p className="stage-description">
            所有同伴评估的综合结果（分数越低越好）：
          </p>
          <div className="aggregate-list">
            {aggregateRankings.map((agg, index) => (
              <div key={index} className="aggregate-item">
                <span className="rank-position">#{index + 1}</span>
                <span className="rank-model">
                  {agg.model.split('/')[1] || agg.model}
                </span>
                <span className="rank-score">
                  平均分：{agg.average_rank.toFixed(2)}
                </span>
                <span className="rank-count">
                  （{agg.rankings_count} 票）
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
