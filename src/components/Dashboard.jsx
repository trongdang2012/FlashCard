import React, { useState, useEffect } from 'react';
import { Layers, Brain, Target, AlertTriangle, ArrowRight, Folder } from 'lucide-react';
import { get } from 'idb-keyval';

export default function Dashboard({ onReviewWrong }) {
  const [stats, setStats] = useState({
    totalCards: 0,
    cardsLearned: 0,
    correctRate: 0,
    oftenWrong: []
  });
  
  const [decksDict, setDecksDict] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const savedCards = (await get('microcards')) || [];
      const savedDecks = (await get('microdecks')) || [];
      
      const dDict = {};
      savedDecks.forEach(d => { dDict[d.id] = d.name; });
      setDecksDict(dDict);

      let totalCorrect = 0;
      let totalWrong = 0;
      let learned = 0;
      
      savedCards.forEach(c => {
        const { correct, wrong } = c.stats;
        totalCorrect += correct;
        totalWrong += wrong;
        if (correct > 0 || wrong > 0) {
          learned += 1;
        }
      });

      const totalAttempts = totalCorrect + totalWrong;
      const rate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

      const wrongList = savedCards
        .filter(c => c.stats.wrong > 0)
        .sort((a, b) => b.stats.wrong - a.stats.wrong);

      setStats({
        totalCards: savedCards.length,
        cardsLearned: learned,
        correctRate: rate,
        oftenWrong: wrongList
      });
      setIsLoading(false);
    };

    loadData();
  }, []);

  if (isLoading) {
    return <div className="text-center py-20 text-slate-500 animate-pulse font-medium">Đang tải dữ liệu thống kê...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mr-4">
            <Layers className="w-7 h-7 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Tổng số thẻ</p>
            <p className="text-3xl font-bold text-slate-800">{stats.totalCards}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mr-4">
            <Brain className="w-7 h-7 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Thẻ đã học</p>
            <p className="text-3xl font-bold text-slate-800">{stats.cardsLearned}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mr-4">
            <Target className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Tỉ lệ đúng</p>
            <p className="text-3xl font-bold text-slate-800">{stats.correctRate}%</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center mb-4 sm:mb-0">
            <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
            Danh sách các câu hay sai
          </h2>
          
          <button
            onClick={onReviewWrong}
            disabled={stats.oftenWrong.length === 0}
            className="inline-flex items-center justify-center px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            ÔN TẬP CÂU SAI
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>

        {stats.oftenWrong.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 font-medium">Bạn chưa có câu nào trả lời sai. Tiếp tục phát huy nhé!</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Hình ảnh</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Đáp án</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Số lần sai</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Tỉ lệ đúng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.oftenWrong.map((card) => {
                  const total = card.stats.correct + card.stats.wrong;
                  const rate = total > 0 ? Math.round((card.stats.correct / total) * 100) : 0;
                  const deckName = decksDict[card.deckId] || 'Bộ thẻ mặc định';

                  return (
                    <tr key={card.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-16 w-24 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                          {/* Sửa object-cover thành object-contain */}
                          <img src={card.image} alt="Thumbnail" className="h-full w-full object-contain p-1" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-800 capitalize mb-1">{card.answer}</div>
                        <div className="flex items-center text-xs text-slate-500">
                          <Folder className="w-3 h-3 mr-1" /> {deckName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {card.stats.wrong} lần
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-slate-600 font-medium">
                          {rate}% <span className="text-slate-400 text-xs font-normal">({card.stats.correct}/{total})</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
