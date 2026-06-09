import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, XCircle, RotateCcw, Folder, Play, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { useDialog } from './DialogContext';

const normalizeString = (str) => {
  if (!str) return '';
  return str
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

// Tách câu hỏi thành tiêu đề + danh sách lựa chọn
function parseQuestion(text) {
  if (!text) return { title: '', options: [] };
  const parts = text.split('\n\n');
  if (parts.length < 2) return { title: text, options: [] };

  const title = parts[0];
  const optionLines = parts.slice(1).join('\n').split('\n');
  const options = [];

  for (const line of optionLines) {
    const match = line.trim().match(/^([A-Z])\.\s+(.+)$/);
    if (match) {
      options.push({ letter: match[1], text: match[2].trim() });
    }
  }

  if (options.length < 2) return { title: text, options: [] };
  return { title, options };
}

export default function StudyMode({ filterCards, initialDeckId, initialLimit, onGoToDashboard }) {
  const { prompt } = useDialog();
  const [decks, setDecks] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId);

  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [studyLimit, setStudyLimit] = useState(null);
  const [studyLimits, setStudyLimits] = useState({});
  const [userInput, setUserInput] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState([]); // Cho MCQ

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
        const count = savedCards.filter(c => c.deckId === initialDeckId).length;
        setCurrentIndex(0);
        setSelectedDeckId(initialDeckId);
        setStudyLimit(initialLimit);
        setIsFinished(count === 0 || (initialLimit === 0));
      } else if (savedDecks.length === 1 && !filterCards) {
        const deck = savedDecks[0];
        const count = savedCards.filter(c => c.deckId === deck.id).length;
        setCurrentIndex(0);
        setSelectedDeckId(deck.id);
        setIsFinished(count === 0);
      }
    };
    loadData();
  }, [initialDeckId, filterCards]);

  const orderRef = useRef({ deckId: null, filter: null, order: [], limit: null, totalCount: 0 });

  useEffect(() => {
    let currentCards = [];
    if (filterCards === 'wrong') {
      currentCards = allCards.filter(c => c.stats.wrong > 0);
    } else if (selectedDeckId) {
      currentCards = allCards.filter(c => c.deckId === selectedDeckId);
    } else {
      setCards([]);
      return;
    }

    if (
      orderRef.current.deckId !== selectedDeckId ||
      orderRef.current.filter !== filterCards ||
      orderRef.current.totalCount !== currentCards.length ||
      orderRef.current.limit !== studyLimit
    ) {
      let shuffled = [...currentCards].sort(() => Math.random() - 0.5);
      if (studyLimit && studyLimit < shuffled.length) {
        shuffled = shuffled.slice(0, studyLimit);
      }
      orderRef.current = {
        deckId: selectedDeckId,
        filter: filterCards,
        order: shuffled.map(c => c.id),
        limit: studyLimit,
        totalCount: currentCards.length
      };
      setCards(shuffled);
    } else {
      const orderedCards = orderRef.current.order.map(id => currentCards.find(c => c.id === id)).filter(Boolean);
      setCards(orderedCards);
    }
  }, [selectedDeckId, filterCards, allCards, studyLimit]);

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

  // ================== HANDLERS ==================

  const handleOptionToggle = (letter) => {
    if (hasChecked) return;
    const l = letter.toLowerCase();
    setSelectedOptions(prev =>
      prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
    );
  };

  const handleCheck = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (hasChecked) return;

    const currentCard = cards[currentIndex];
    const { options: questionOptions } = parseQuestion(currentCard.question);
    const hasMCQOptions = questionOptions.length >= 2;

    if (hasMCQOptions) {
      // Chế độ trắc nghiệm
      if (selectedOptions.length === 0) return;

      const correctLetters = currentCard.answer.split(',').map(a => a.trim().toLowerCase()).sort();
      const selectedSorted = [...selectedOptions].sort();
      const isExactMatch = JSON.stringify(correctLetters) === JSON.stringify(selectedSorted);

      setSessionResults(prev => {
        if (prev[currentIndex] !== undefined) return prev;
        return { ...prev, [currentIndex]: isExactMatch };
      });

      const updatedAllCards = allCards.map(c => {
        if (c.id === currentCard.id) {
          return {
            ...c,
            stats: {
              correct: isExactMatch ? c.stats.correct + 1 : c.stats.correct,
              wrong: !isExactMatch ? c.stats.wrong + 1 : c.stats.wrong,
            }
          };
        }
        return c;
      });
      await set('microcards', updatedAllCards);
      setAllCards(updatedAllCards);
      setHasChecked(true);
      // Không flip card cho MCQ - hiện kết quả trực tiếp

    } else {
      // Chế độ nhập chữ (cho ảnh và thẻ tự do)
      if (!userInput.trim()) return;

      const userAns = normalizeString(userInput);
      const correctAns = normalizeString(currentCard.answer);
      const isExactMatch = userAns === correctAns;

      setSessionResults(prev => {
        if (prev[currentIndex] !== undefined) return prev;
        return { ...prev, [currentIndex]: isExactMatch };
      });

      const updatedAllCards = allCards.map(c => {
        if (c.id === currentCard.id) {
          return {
            ...c,
            stats: {
              correct: isExactMatch ? c.stats.correct + 1 : c.stats.correct,
              wrong: !isExactMatch ? c.stats.wrong + 1 : c.stats.wrong,
            }
          };
        }
        return c;
      });

      await set('microcards', updatedAllCards);
      setAllCards(updatedAllCards);
      setHasChecked(true);
      setIsFlipped(true);
    }
  };

  const handleEditAnswer = async () => {
    const currentCard = cards[currentIndex];
    const newAnswer = await prompt('Sửa đáp án cho thẻ này:', currentCard.answer);
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
      setSelectedOptions([]);
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
      setSelectedOptions([]);
      setHasChecked(false);
      setIsFlipped(false);
    }
  };

  const resetStudy = async () => {
    setCurrentIndex(0);
    setUserInput('');
    setSelectedOptions([]);
    setHasChecked(false);
    setIsFlipped(false);
    setIsFinished(cards.length === 0);
    setSessionResults({});
    if (!filterCards && selectedDeckId) {
      const updatedDecks = decks.map(d => d.id === selectedDeckId ? { ...d, lastStudiedIndex: 0, isCompleted: false } : d);
      await set('microdecks', updatedDecks);
      setDecks(updatedDecks);
    }
  };

  // ================== VIEWS ==================

  // View: Chọn bộ thẻ
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
              return (
                <div key={deck.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
                  <div className="flex items-center mb-4">
                    <Folder className="w-6 h-6 text-indigo-500 mr-3" />
                    <h3 className="text-xl font-bold text-slate-800">{deck.name}</h3>
                  </div>
                  <p className="text-slate-500 mb-6 flex-1">Số lượng: {count} thẻ</p>

                  {count > 0 && (
                    <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Số câu muốn học:</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max={count}
                          value={studyLimits[deck.id] || count}
                          onChange={(e) => setStudyLimits(prev => ({ ...prev, [deck.id]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2 px-3 outline-none transition-all bg-white"
                        />
                        <span className="text-sm text-slate-500 font-medium whitespace-nowrap">/ {count}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const limit = studyLimits[deck.id] ? parseInt(studyLimits[deck.id], 10) : count;
                      setCurrentIndex(0);
                      setStudyLimit(limit);
                      setIsFinished(count === 0);
                      setSelectedDeckId(deck.id);
                    }}
                    disabled={count === 0}
                    className="w-full flex items-center justify-center bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {count === 0 ? 'Chưa có thẻ' : 'Bắt đầu học'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // View: Không có thẻ / đã xong
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

  // View: Màn hình kết quả cuối
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

  // ================== STUDY VIEW ==================
  const currentCard = cards[currentIndex];
  const { title: questionTitle, options: questionOptions } = parseQuestion(currentCard.question);
  const hasMCQOptions = questionOptions.length >= 2;
  const correctLetters = currentCard.answer.split(',').map(a => a.trim().toLowerCase());
  const isMultipleChoice = correctLetters.length > 1;
  const mcqIsCorrect = hasChecked && hasMCQOptions &&
    JSON.stringify([...correctLetters].sort()) === JSON.stringify([...selectedOptions].sort());

  const deckName = filterCards === 'wrong' ? 'Ôn tập câu sai' : (decks.find(d => d.id === selectedDeckId)?.name || 'Học bài');

  // ---- Render MCQ Mode ----
  if (hasMCQOptions) {
    return (
      <div className="max-w-3xl mx-auto py-2">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
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
            <h2 className="text-lg font-bold text-slate-700 truncate max-w-xs">{deckName}</h2>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-indigo-50 rounded-full border border-indigo-100 shadow-sm p-0.5">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="p-1 text-indigo-600 hover:bg-white rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
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
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setIsFinished(true)}
              className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors border border-slate-200 bg-white px-3 py-1.5 rounded-full shadow-sm hover:border-red-200 hover:bg-red-50"
            >
              Kết thúc
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${(currentIndex / cards.length) * 100}%` }}
          />
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-4">
          {/* Question number badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full tracking-wide uppercase">
              Câu {currentIndex + 1}
            </span>
            {isMultipleChoice && (
              <span className="text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full">
                Chọn {correctLetters.length} đáp án
              </span>
            )}
          </div>

          {/* Question text */}
          <p className="text-xl font-bold text-slate-800 leading-relaxed">
            {questionTitle}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5 mb-5">
          {questionOptions.map((opt) => {
            const letter = opt.letter.toLowerCase();
            const isSelected = selectedOptions.includes(letter);
            const isCorrectOpt = correctLetters.includes(letter);

            let btnClass = '';
            let letterClass = '';
            let icon = null;

            if (!hasChecked) {
              if (isSelected) {
                btnClass = 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200';
                letterClass = 'bg-indigo-500 text-white';
              } else {
                btnClass = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50';
                letterClass = 'bg-slate-100 text-slate-600';
              }
            } else {
              if (isCorrectOpt) {
                btnClass = 'border-green-400 bg-green-50';
                letterClass = 'bg-green-500 text-white';
                icon = <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
              } else if (isSelected && !isCorrectOpt) {
                btnClass = 'border-red-400 bg-red-50';
                letterClass = 'bg-red-400 text-white';
                icon = <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
              } else {
                btnClass = 'border-slate-200 bg-slate-50 opacity-70';
                letterClass = 'bg-slate-200 text-slate-500';
              }
            }

            return (
              <button
                key={opt.letter}
                onClick={() => handleOptionToggle(opt.letter)}
                disabled={hasChecked}
                className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-150 ${btnClass} ${!hasChecked ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'}`}
              >
                {/* Letter badge */}
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${letterClass}`}>
                  {opt.letter}
                </span>
                {/* Option text */}
                <span className={`flex-1 text-sm font-medium leading-relaxed pt-0.5 ${hasChecked && isCorrectOpt ? 'text-green-800' : hasChecked && isSelected && !isCorrectOpt ? 'text-red-700' : 'text-slate-700'}`}>
                  {opt.text}
                </span>
                {/* Result icon */}
                {icon && <div className="pt-0.5">{icon}</div>}
              </button>
            );
          })}
        </div>

        {/* Result banner */}
        <AnimatePresence>
          {hasChecked && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-xl p-4 mb-5 border flex items-center justify-between gap-3 ${mcqIsCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              <div className="flex items-center gap-3">
                {mcqIsCorrect
                  ? <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                  : <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                }
                <div>
                  <p className={`font-bold ${mcqIsCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {mcqIsCorrect ? 'Chính xác!' : 'Sai rồi!'}
                  </p>
                  {!mcqIsCorrect && (
                    <p className="text-sm text-slate-600 mt-0.5">
                      Đáp án đúng: <span className="font-bold text-green-700 uppercase">{correctLetters.join(', ')}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleEditAnswer}
                className="text-indigo-500 hover:text-indigo-700 flex items-center text-xs font-semibold bg-white px-2.5 py-1.5 rounded-lg shadow-sm border border-indigo-100 flex-shrink-0"
              >
                <Edit2 className="w-3 h-3 mr-1" /> Sửa đáp án
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action button */}
        <div className="flex justify-end">
          {!hasChecked ? (
            <button
              onClick={handleCheck}
              disabled={selectedOptions.length === 0}
              className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm text-sm active:scale-95"
            >
              Kiểm tra
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-8 py-3.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors flex items-center shadow-sm text-sm active:scale-95"
            >
              Tiếp theo <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- Render Image/Text Card Mode (giữ nguyên UX cũ) ----
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
        />
      </div>

      {/* Card Container for 3D Flip */}
      <div className="relative w-full max-h-72 h-72 sm:max-h-96 sm:h-96 perspective-1000 mb-8 z-10 mx-auto">
        <motion.div
          className="w-full h-full relative preserve-3d"
          animate={{ rotateX: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
        >
          {/* Front */}
          <div className="absolute w-full h-full backface-hidden bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex-1 bg-slate-100 relative p-4 flex items-center justify-center overflow-hidden">
              {currentCard.image ? (
                <img
                  src={currentCard.image}
                  alt="Flashcard"
                  className="w-full h-full object-contain rounded-md shadow-sm border border-slate-200/50"
                />
              ) : (
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 text-center px-4">
                  {currentCard.question}
                </h2>
              )}
            </div>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full backface-hidden bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center p-8 rotate-x-180">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Đáp án</h3>
            <p className="text-3xl sm:text-4xl font-bold text-slate-800 text-center capitalize leading-tight">
              {currentCard.answer}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 z-20 relative">
        <form onSubmit={handleCheck}>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={hasChecked}
              placeholder="Nhập đáp án của bạn..."
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
