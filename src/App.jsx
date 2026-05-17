import React, { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import CardEditor from './components/CardEditor';
import StudyMode from './components/StudyMode';
import Dashboard from './components/Dashboard';
import { LayoutDashboard, Edit, BookOpen } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'study', 'dashboard'
  const [studyFilter, setStudyFilter] = useState(null); // 'wrong' or null
  const [studyDeckId, setStudyDeckId] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Migration logic from localStorage to IndexedDB
  useEffect(() => {
    const migrateData = async () => {
      let idbDecks = await get('microdecks');
      let idbCards = await get('microcards');

      // Cũ: Kiểm tra nếu có dữ liệu ở localStorage thì migrate sang IndexedDB
      const lsDecksStr = localStorage.getItem('microdecks');
      const lsCardsStr = localStorage.getItem('microcards');

      if (!idbDecks && !idbCards && (lsDecksStr || lsCardsStr)) {
        console.log('Migrating data from localStorage to IndexedDB...');
        const lsDecks = JSON.parse(lsDecksStr || '[]');
        const lsCards = JSON.parse(lsCardsStr || '[]');

        await set('microdecks', lsDecks);
        await set('microcards', lsCards);

        idbDecks = lsDecks;
        idbCards = lsCards;
      }

      if (!idbDecks) await set('microdecks', []);
      if (!idbCards) await set('microcards', []);

      setIsReady(true);
    };

    migrateData();
  }, []);

  const handleReviewWrong = () => {
    setActiveTab('study');
    setStudyFilter('wrong');
    setStudyDeckId(null); // Review wrong from ALL decks
  };

  const handleStudyDeck = (deckId) => {
    setActiveTab('study');
    setStudyFilter(null);
    setStudyDeckId(deckId);
  };

  const renderContent = () => {
    if (!isReady) {
      return <div className="text-center py-20 text-slate-500 animate-pulse font-medium">Đang khởi tạo bộ nhớ...</div>;
    }

    switch (activeTab) {
      case 'editor':
        return <CardEditor onStudyDeck={handleStudyDeck} />;
      case 'study':
        return <StudyMode filterCards={studyFilter} initialDeckId={studyDeckId} onGoToDashboard={() => setActiveTab('dashboard')} />;
      case 'dashboard':
        return <Dashboard onReviewWrong={handleReviewWrong} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-200">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">FlashCard</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => { setActiveTab('editor'); setStudyFilter(null); setStudyDeckId(null); }}
                  className={`${activeTab === 'editor'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200`}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Quản lý thẻ
                </button>
                <button
                  onClick={() => { setActiveTab('study'); setStudyFilter(null); setStudyDeckId(null); }}
                  className={`${activeTab === 'study'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200`}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Học bài
                </button>
                <button
                  onClick={() => { setActiveTab('dashboard'); setStudyFilter(null); setStudyDeckId(null); }}
                  className={`${activeTab === 'dashboard'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200`}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Thống kê
                </button>
              </div>
            </div>

            <div className="flex items-center sm:hidden space-x-4">
              <button onClick={() => { setActiveTab('editor'); setStudyFilter(null); setStudyDeckId(null); }} className={`p-2 rounded-md ${activeTab === 'editor' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500'}`}>
                <Edit className="w-5 h-5" />
              </button>
              <button onClick={() => { setActiveTab('study'); setStudyFilter(null); setStudyDeckId(null); }} className={`p-2 rounded-md ${activeTab === 'study' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500'}`}>
                <BookOpen className="w-5 h-5" />
              </button>
              <button onClick={() => { setActiveTab('dashboard'); setStudyFilter(null); setStudyDeckId(null); }} className={`p-2 rounded-md ${activeTab === 'dashboard' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500'}`}>
                <LayoutDashboard className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
