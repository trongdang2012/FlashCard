import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, XCircle, RotateCcw, Folder, Play, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { get, set } from 'idb-keyval';

const normalizeString = (str) => {
  if (!str) return '';
  return str
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export default function StudyMode({ filterCards, initialDeckId, onGoToDashboard }) {
  const [decks, setDecks] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId);
  
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // Tracking correct answers per card index for the current session
  const [sessionResults, setSessionResults] = useState({});

  useEffect(() => {
    const loadData = async () => {
      const savedDecks = (await get('microdecks')) || [];
      const savedCards = (await get('microcards')) || [];
      setDecks(savedDecks);
      setAllCards(savedCards);
      
      if (filterCards === 'wrong') {
        const wrongCards = savedCards.filter(c => c.stats.wrong > 0);
        setCurrentIndex(0);
        setIsFinished(wrongCards.length === 0);
      } else if (initialDeckId) {
        const deck = savedDecks.find(d => d.id === initialDeckId);
        const count = savedCards.filter(c => c.deckId === initialDeckId).length;
        const savedIndex = deck?.lastStudiedIndex || 0;
        setCurrentIndex(savedIndex >= count ? 0 : savedIndex);
        setSelectedDeckId(initialDeckId);
        setIsFinished(count === 0);
      } else if (savedDecks.length === 1 && !filterCards) {
        const deck = savedDecks[0];
        const count = savedCards.filter(c => c.deckId === deck.id).length;
        const savedIndex = deck?.lastStudiedIndex || 0;
        setCurrentIndex(savedIndex >= count ? 0 : savedIndex);
        setSelectedDeckId(deck.id);
        setIsFinished(count === 0);
      }
    };
    loadData();
  }, [initialDeckId, filterCards]);

  useEffect(() => {
    if (filterCards === 'wrong') {
      const wrongCards = allCards.filter(c => c.stats.wrong > 0).sort((a, b) => b.stats.wrong - a.stats.wrong);
      setCards(wrongCards);
    } else if (selectedDeckId) {
      const deckCards = allCards.filter(c => c.deckId === selectedDeckId);
      setCards(deckCards);
    }
  }, [selectedDeckId, filterCards, allCards]);

  useEffect(() => {
    const saveProgress = async () => {
      if (!filterCards && selectedDeckId && cards.length > 0 && !hasChecked) {
        const updatedDecks = decks.map(d => {
          if (d.id === selectedDeckId) {
            return { ...d, lastStudiedIndex: currentIndex, isCompleted: isFinished };
          }
          return d;
        });
        await set('microdecks', updatedDecks);
      }
    };
    saveProgress();
  }, [currentIndex, isFinished, selectedDeckId, filterCards, decks, cards, hasChecked]);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || hasChecked) return;

    const currentCard = cards[currentIndex];
    const userAns = normalizeString(userInput);
    const correctAns = normalizeString(currentCard.answer);
    const isExactMatch = userAns === correctAns;

    // Update Session Results (only record the first check per card in a session)
    setSessionResults(prev => {
      if (prev[currentIndex] !== undefined) return prev; // Already answered
      return { ...prev, [currentIndex]: isExactMatch };
    });

    const updatedAllCards = allCards.map(c => {
      if (c.id === currentCard.id) {
        return {
          ...c,
          stats: {
            ...c.stats,
            correct: isExactMatch ? c.stats.correct + 1 : c.stats.correct,
            wrong: !isExactMatch ? c.stats.wrong + 1 : c.stats.wrong
          }
        };
      }
      return c;
    });

    await set('microcards', updatedAllCards);
    setAllCards(updatedAllCards); 
    setHasChecked(true);
    setIsFlipped(true);
  };

  const handleEditAnswer = async () => {
    const currentCard = cards[currentIndex];
    const newAnswer = window.prompt('Sửa đáp án cho ảnh này:', currentCard.answer);
    if (newAnswer !== null && newAnswer.trim() !== '') {
      const updatedAllCards = allCards.map(c => 
        c.id === currentCard.id ? { ...c, answer: newAnswer.trim().toLowerCase() } : c
      );
      await set('microcards', updatedAllCards);
      setAllCards(updatedAllCards);
    }
  };

  const handleNext = async () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setHasChecked(false);
      setIsFlipped(false);
    } else {
      setIsFinished(true);
      if (!filterCards && selectedDeckId) {
         const updatedDecks = decks.map(d => d.id === selectedDeckId ? { ...d, lastStudiedIndex: 0, isCompleted: true } : d);
         await set('microdecks', updatedDecks);
         setDecks(updatedDecks);
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setUserInput('');
      setHasChecked(false);
      setIsFlipped(false);
    }
  };

  const resetStudy = async () => {
    setCurrentIndex(0);
    setUserInput('');
    setHasChecked(false);
    setIsFlipped(false);
    setIsFinished(cards.length === 0);
    setSessionResults({}); // Reset session results
    if (!filterCards && selectedDeckId) {
       const updatedDecks = decks.map(d => d.id === selectedDeckId ? { ...d, lastStudiedIndex: 0, isCompleted: false } : d);
       await set('microdecks', updatedDecks);
       setDecks(updatedDecks);
    }
  };

  // View: Deck Selection
  if (!selectedDeckId && !filterCards) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-bold text-slate-800">Chọn bộ thẻ để học</h2>
        {decks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
             <p className="text-slate-500 text-lg">Chưa có bộ thẻ nào. Hãy qua Tab Quản lý tạo bộ thẻ mới!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map(deck => {
              const count = allCards.filter(c => c.deckId === deck.id).length;
              const progress = count > 0 ? Math.round((deck.lastStudiedIndex / count) * 100) : 0;
              return (
                <div key={deck.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
                  <div className="flex items-center mb-4">
                    <Folder className="w-6 h-6 text-indigo-500 mr-3" />
                    <h3 className="text-xl font-bold text-slate-800">{deck.name}</h3>
                  </div>
                  <p className="text-slate-500 mb-6 flex-1">Số lượng: {count} thẻ</p>
                  
                  {count > 0 && deck.lastStudiedIndex > 0 && deck.lastStudiedIndex < count && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Đang học dở...</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const savedIndex = deck.lastStudiedIndex || 0;
                      setCurrentIndex(savedIndex >= count ? 0 : savedIndex);
                      setIsFinished(count === 0);
                      setSelectedDeckId(deck.id);
                    }}
                    disabled={count === 0}
                    className="w-full flex items-center justify-center bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {count === 0 ? 'Chưa có thẻ' : (deck.lastStudiedIndex > 0 ? 'Học tiếp' : 'Học bộ này')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Study View
  if (cards.length === 0 || !cards[currentIndex]) {
    if (isFinished) {
      return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Không có thẻ nào để học!</h2>
          <p className="text-slate-500 mb-8">
            {filterCards === 'wrong' ? 'Tuyệt vời! Bạn không có thẻ nào hay sai.' : 'Hãy thêm thẻ mới vào bộ này nhé.'}
          </p>
          <div className="flex space-x-4">
            {!filterCards && (
              <button onClick={() => setSelectedDeckId(null)} className="text-indigo-600 font-medium hover:underline">
                Quay lại chọn bộ thẻ
              </button>
            )}
            {filterCards === 'wrong' && (
              <button onClick={onGoToDashboard} className="text-indigo-600 font-medium hover:underline">
                Quay lại trang Thống kê
              </button>
            )}
          </div>
        </div>
      );
    }
    return <div className="text-center py-20 text-slate-500 animate-pulse font-medium">Đang tải dữ liệu bộ thẻ...</div>;
  }

  if (isFinished) {
    const correctCount = Object.values(sessionResults).filter(v => v).length;
    const totalCount = cards.length;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Hoàn thành bài học!</h2>
        <p className="text-slate-500 mb-6 text-center max-w-md">Bạn đã kết thúc việc học bộ thẻ này.</p>
        
        {totalCount > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm text-center min-w-[250px] animate-in zoom-in duration-500">
            <p className="text-sm font-medium text-slate-500 mb-2">Điểm số của bạn</p>
            <div className="text-5xl font-black text-indigo-600 mb-1">{accuracy}%</div>
            <p className="text-sm text-slate-400 font-medium">({correctCount} đúng / {totalCount} thẻ)</p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={resetStudy}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Học lại từ đầu
          </button>
          {!filterCards && (
            <button
              onClick={() => setSelectedDeckId(null)}
              className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              Chọn bộ thẻ khác
            </button>
          )}
          {filterCards === 'wrong' && (
            <button
              onClick={onGoToDashboard}
              className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              Quay lại Thống kê
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  const renderSpellCheck = () => {
    if (!hasChecked) return null;
    
    const correctAns = normalizeString(currentCard.answer);
    const userAns = normalizeString(userInput);
    
    const maxLength = Math.max(correctAns.length, userAns.length);
    let resultHTML = [];

    for (let i = 0; i < maxLength; i++) {
      const charCorrect = correctAns[i] || ''; 
      const charUser = userAns[i] || '';       

      if (charCorrect === charUser) {
        resultHTML.push(
          <span key={i} className="text-green-500 font-bold text-xl">
            {charUser === ' ' ? '\u00A0' : charUser}
          </span>
        );
      } else {
        const displayChar = charUser === '' ? '_' : (charUser === ' ' ? '\u00A0' : charUser);
        resultHTML.push(
          <span key={i} className="text-red-500 font-bold text-xl bg-red-50 px-[1px] rounded-sm">
            {displayChar}
          </span>
        );
      }
    }

    const isPerfect = userAns === correctAns;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mt-6 p-6 rounded-xl border ${isPerfect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
      >
        <div className="flex items-center mb-4">
          {isPerfect ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 mr-2" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500 mr-2" />
          )}
          <h3 className={`font-bold ${isPerfect ? 'text-green-700' : 'text-red-700'}`}>
            {isPerfect ? 'Chính xác hoàn toàn!' : 'Có lỗi sai chính tả!'}
          </h3>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">Kết quả gõ của bạn:</p>
          <div className="font-mono flex flex-wrap break-words tracking-wide">
            {resultHTML}
          </div>
        </div>

        {!isPerfect && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-slate-500">Đáp án đúng:</p>
              <button onClick={handleEditAnswer} type="button" className="text-indigo-500 hover:text-indigo-700 flex items-center text-xs font-semibold">
                <Edit2 className="w-3 h-3 mr-1" /> Sửa đáp án
              </button>
            </div>
            <p className="font-mono text-xl tracking-wide text-green-600 font-bold break-words bg-white/50 p-2 rounded inline-block">
              {currentCard.answer}
            </p>
          </div>
        )}
        {isPerfect && (
          <div className="mt-4 flex justify-end">
             <button onClick={handleEditAnswer} type="button" className="text-indigo-500 hover:text-indigo-700 flex items-center text-xs font-semibold bg-white px-2 py-1 rounded shadow-sm border border-indigo-100">
                <Edit2 className="w-3 h-3 mr-1" /> Sửa đáp án thẻ này
             </button>
          </div>
        )}
      </motion.div>
    );
  };

  const deckName = filterCards === 'wrong' ? 'Ôn tập câu sai' : (decks.find(d => d.id === selectedDeckId)?.name || 'Học bài');

  return (
    <div className="max-w-4xl mx-auto py-2">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          {!filterCards && decks.length > 1 && (
            <button 
              onClick={() => setSelectedDeckId(null)}
              className="mr-4 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Quay lại danh sách bộ"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-xl font-bold text-slate-800">{deckName}</h2>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-indigo-50 rounded-full border border-indigo-100 shadow-sm p-0.5">
            <button 
              onClick={handlePrev} 
              disabled={currentIndex === 0} 
              className="p-1 text-indigo-600 hover:bg-white rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Câu trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-indigo-600 px-3 min-w-[70px] text-center">
              {currentIndex + 1} / {cards.length}
            </span>
            <button 
              onClick={handleNext} 
              disabled={currentIndex === cards.length - 1 && hasChecked} 
              className="p-1 text-indigo-600 hover:bg-white rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Bỏ qua / Câu tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsFinished(true)}
            className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors border border-slate-200 bg-white px-3 py-1.5 rounded-full shadow-sm hover:border-red-200 hover:bg-red-50"
          >
            Kết thúc
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
        ></div>
      </div>

      {/* Card Container for 3D Flip */}
      <div className="relative w-full max-h-72 h-72 sm:max-h-96 sm:h-96 perspective-1000 mb-8 z-10 mx-auto">
        <motion.div
          className="w-full h-full relative preserve-3d"
          animate={{ rotateX: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
        >
          {/* Front of Card */}
          <div className="absolute w-full h-full backface-hidden bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex-1 bg-slate-100 relative p-4 flex items-center justify-center overflow-hidden">
              <img 
                src={currentCard.image} 
                alt="Flashcard" 
                className="w-full h-full object-contain rounded-md shadow-sm border border-slate-200/50"
              />
            </div>
          </div>

          {/* Back of Card (Answer) */}
          <div className="absolute w-full h-full backface-hidden bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center p-8 rotate-x-180">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Đáp án</h3>
            <p className="text-3xl sm:text-4xl font-bold text-slate-800 text-center capitalize leading-tight">
              {currentCard.answer}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Input Form & Checking */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 z-20 relative">
        <form onSubmit={handleCheck}>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={hasChecked}
              placeholder="Nhập tên vi thể bạn thấy..."
              className="flex-1 rounded-xl border-0 py-4 pl-6 pr-4 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 text-lg shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
              autoFocus
            />
            {!hasChecked ? (
              <button
                type="submit"
                disabled={!userInput.trim()}
                className="bg-indigo-600 text-white px-8 py-4 sm:py-0 rounded-xl font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
              >
                Kiểm tra
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="bg-slate-800 text-white px-8 py-4 sm:py-0 rounded-xl font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center shadow-sm active:scale-95"
              >
                Tiếp theo <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            )}
          </div>
        </form>

        <AnimatePresence>
          {hasChecked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {renderSpellCheck()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
