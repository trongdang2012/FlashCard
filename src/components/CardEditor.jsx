import React, { useState, useEffect } from 'react';
import { ImagePlus, Trash2, Edit2, Save, Plus, Folder, ChevronLeft, Play, LayoutGrid, Download, Upload, Type, Shuffle, Layers, X } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { useDialog } from './DialogContext';

export default function CardEditor({ onStudyDeck }) {
  const { alert, confirm, prompt } = useDialog();
  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [studyLimits, setStudyLimits] = useState({});
  
  // Bulk upload state
  const [bulkItems, setBulkItems] = useState([]);

  // Split deck state
  const [splitModal, setSplitModal] = useState(null); // { deckId, deckName, totalCards }
  const [splitParts, setSplitParts] = useState(3);

  // Text card state
  const [textQuestion, setTextQuestion] = useState('');
  const [textAnswer, setTextAnswer] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const savedDecks = (await get('microdecks')) || [];
      const savedCards = (await get('microcards')) || [];
      setDecks(savedDecks);
      setCards(savedCards);
    };
    loadData();
  }, []);

  const handleCreateDeck = async () => {
    const name = await prompt('Nhập tên bộ thẻ mới:');
    if (name && name.trim()) {
      const newDeck = { id: Date.now().toString(), name: name.trim(), lastStudiedIndex: 0, isCompleted: false };
      const updatedDecks = [...decks, newDeck];
      await set('microdecks', updatedDecks);
      setDecks(updatedDecks);
    }
  };

  const handleDeleteDeck = async (id) => {
    if (await confirm('Bạn có chắc muốn xóa bộ thẻ này và toàn bộ thẻ bên trong?')) {
      const deck = decks.find(d => d.id === id);
      // Xóa cả các bộ con nếu đây là bộ cha
      let idsToDelete = [id];
      if (deck?.subDeckIds?.length) {
        idsToDelete = [...idsToDelete, ...deck.subDeckIds];
      }
      const updatedDecks = decks.filter(d => !idsToDelete.includes(d.id));
      const updatedCards = cards.filter(c => !idsToDelete.includes(c.deckId));
      await set('microdecks', updatedDecks);
      await set('microcards', updatedCards);
      setDecks(updatedDecks);
      setCards(updatedCards);
    }
  };

  // Chia bộ thẻ thành N phần ngẫu nhiên không trùng lặp
  const handleSplitDeck = async (sourceDeckId, numParts) => {
    const sourceDeck = decks.find(d => d.id === sourceDeckId);
    const sourceCards = cards.filter(c => c.deckId === sourceDeckId);

    if (!sourceDeck || sourceCards.length === 0) return;
    if (numParts < 2 || numParts > sourceCards.length) {
      await alert(`Số phần phải từ 2 đến ${sourceCards.length}.`);
      return;
    }

    // Xóa các bộ con cũ nếu đã chia trước đó
    let allDecks = [...decks];
    let allCards = [...cards];
    if (sourceDeck.subDeckIds?.length) {
      allDecks = allDecks.filter(d => !sourceDeck.subDeckIds.includes(d.id));
      allCards = allCards.filter(c => !sourceDeck.subDeckIds.includes(c.deckId));
    }

    // Xáo trộn ngẫu nhiên
    const shuffled = [...sourceCards].sort(() => Math.random() - 0.5);
    const chunkSize = Math.ceil(shuffled.length / numParts);

    const newSubDecks = [];
    const newCards = [];
    const newSubDeckIds = [];

    for (let i = 0; i < numParts; i++) {
      const chunk = shuffled.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length === 0) continue;

      const subDeckId = `${sourceDeckId}_part${i + 1}_${Date.now()}`;
      newSubDeckIds.push(subDeckId);

      newSubDecks.push({
        id: subDeckId,
        name: `${sourceDeck.name} — Phần ${i + 1}`,
        lastStudiedIndex: 0,
        isCompleted: false,
        parentDeckId: sourceDeckId,
        partNumber: i + 1,
        totalParts: numParts,
      });

      chunk.forEach(card => {
        newCards.push({
          ...card,
          id: `${card.id}_p${i + 1}_${Date.now() + Math.random()}`,
          deckId: subDeckId,
          stats: { correct: 0, wrong: 0 }, // stats mới cho bộ con
        });
      });
    }

    // Cập nhật bộ cha với danh sách subDeckIds
    const updatedDecks = allDecks.map(d =>
      d.id === sourceDeckId ? { ...d, subDeckIds: newSubDeckIds } : d
    );
    const finalDecks = [...updatedDecks, ...newSubDecks];
    const finalCards = [...allCards, ...newCards];

    await set('microdecks', finalDecks);
    await set('microcards', finalCards);
    setDecks(finalDecks);
    setCards(finalCards);
    setSplitModal(null);
  };

  // Nạp ảnh nguyên bản (không nén)
  const handleBulkImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newItems = [];
    let processedCount = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newItems.push({
          id: Date.now().toString() + Math.random(),
          image: reader.result, // Lưu giữ chất lượng gốc
          answer: ''
        });
        processedCount++;
        if (processedCount === files.length) {
          setBulkItems(prev => [...prev, ...newItems]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = ''; // Reset input
  };

  const handleBulkAnswerChange = (id, newAnswer) => {
    setBulkItems(prev => prev.map(item => item.id === id ? { ...item, answer: newAnswer } : item));
  };

  const handleAddTextCard = async (e) => {
    e.preventDefault();
    if (!textQuestion.trim() || !textAnswer.trim()) {
      await alert('Vui lòng nhập cả câu hỏi và đáp án!');
      return;
    }
    const newCard = {
      id: Date.now().toString() + Math.random(),
      deckId: selectedDeckId,
      image: null,
      question: textQuestion.trim(),
      answer: textAnswer.trim().toLowerCase(),
      stats: { correct: 0, wrong: 0 }
    };
    const updatedCards = [...cards, newCard];
    try {
      await set('microcards', updatedCards);
      setCards(updatedCards);
      setTextQuestion('');
      setTextAnswer('');
    } catch (err) {
      console.error(err);
      await alert('Không thể lưu thẻ: ' + err.message);
    }
  };

  const removeBulkItem = (id) => {
    setBulkItems(prev => prev.filter(item => item.id !== id));
  };

  const saveBulkCards = async () => {
    const invalidItems = bulkItems.filter(i => !i.answer.trim());
    if (invalidItems.length > 0) {
      await alert('Vui lòng nhập đáp án cho tất cả các ảnh trước khi lưu!');
      return;
    }

    const newCards = bulkItems.map(item => ({
      id: Date.now().toString() + Math.random(),
      deckId: selectedDeckId,
      image: item.image,
      answer: item.answer.trim().toLowerCase(),
      stats: { correct: 0, wrong: 0 }
    }));

    const updatedCards = [...cards, ...newCards];
    try {
      await set('microcards', updatedCards);
      setCards(updatedCards);
      setBulkItems([]); // Clear draft
    } catch (err) {
      console.error(err);
      await alert('Không thể lưu thẻ: ' + err.message);
    }
  };

  const handleDeleteCard = async (id) => {
    if (await confirm('Bạn có chắc chắn muốn xóa thẻ này?')) {
      const updatedCards = cards.filter(c => c.id !== id);
      await set('microcards', updatedCards);
      setCards(updatedCards);
    }
  };

  const handleEditCard = async (id, oldAnswer) => {
    const newAnswer = await prompt('Sửa đáp án:', oldAnswer);
    if (newAnswer !== null && newAnswer.trim() !== '') {
      const updatedCards = cards.map(c => c.id === id ? { ...c, answer: newAnswer.trim().toLowerCase() } : c);
      await set('microcards', updatedCards);
      setCards(updatedCards);
    }
  };

  const handleExport = async () => {
    try {
      const exportData = { decks, cards };
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `microcard_backup_${new Date().getTime()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      await alert('Có lỗi khi xuất dữ liệu: ' + error.message);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data && Array.isArray(data.decks) && Array.isArray(data.cards)) {
          if (await confirm(`Tìm thấy ${data.decks.length} bộ thẻ và ${data.cards.length} thẻ. Bạn có chắc chắn muốn nạp dữ liệu này? (Dữ liệu mới sẽ được gộp vào dữ liệu hiện tại)`)) {
            const newDecks = [...decks];
            const newCards = [...cards];
            
            data.decks.forEach(d => {
              if (!newDecks.find(existing => existing.id === d.id)) newDecks.push(d);
            });
            data.cards.forEach(c => {
              if (!newCards.find(existing => existing.id === c.id)) newCards.push(c);
            });

            await set('microdecks', newDecks);
            await set('microcards', newCards);
            setDecks(newDecks);
            setCards(newCards);
            await alert('Nhập dữ liệu thành công!');
          }
        } else {
          await alert('File không hợp lệ hoặc bị hỏng.');
        }
      } catch (error) {
        await alert('Lỗi đọc file: ' + error.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // View: Deck List
  if (!selectedDeckId) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
            <LayoutGrid className="w-6 h-6 mr-3 text-indigo-500" />
            Quản lý Bộ thẻ
          </h2>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Nhập
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={handleExport}
              disabled={decks.length === 0}
              className="inline-flex items-center rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 mr-2" />
              Xuất
            </button>
            <button
              onClick={handleCreateDeck}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Plus className="w-5 h-5 mr-1" />
              Tạo bộ mới
            </button>
          </div>
        </div>

        {decks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <Folder className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">Chưa có bộ thẻ nào.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map(deck => {
              const deckCards = cards.filter(c => c.deckId === deck.id);
              const isSubDeck = !!deck.parentDeckId;
              const hasSubDecks = deck.subDeckIds?.length > 0;
              const subDecksOfThis = decks.filter(d => d.parentDeckId === deck.id);

              return (
                <div
                  key={deck.id}
                  className={`bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-all group relative overflow-hidden ${
                    isSubDeck
                      ? 'border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40'
                      : 'border-slate-100'
                  }`}
                >
                  {/* Badge bộ con */}
                  {isSubDeck && (
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Phần {deck.partNumber}/{deck.totalParts}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4" style={{ marginTop: isSubDeck ? '16px' : '0' }}>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-slate-800 leading-snug line-clamp-2" title={deck.name}>{deck.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">{deckCards.length} thẻ</p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSubDeck ? 'bg-indigo-100' : 'bg-indigo-50'
                    }`}>
                      {isSubDeck
                        ? <Layers className="w-5 h-5 text-indigo-600" />
                        : <Folder className="w-5 h-5 text-indigo-500" />
                      }
                    </div>
                  </div>

                  {/* Hiển thị bộ con đã chia */}
                  {hasSubDecks && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {subDecksOfThis.map(sd => (
                        <span key={sd.id} className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Phần {sd.partNumber}: {cards.filter(c => c.deckId === sd.id).length} câu
                        </span>
                      ))}
                    </div>
                  )}

                  {deckCards.length > 0 && (
                    <div className="mt-2 mb-1 flex items-center justify-between text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-medium text-xs">Số câu muốn học:</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="1"
                          max={deckCards.length}
                          value={studyLimits[deck.id] || deckCards.length}
                          onChange={(e) => setStudyLimits(prev => ({ ...prev, [deck.id]: e.target.value }))}
                          className="w-14 rounded border border-slate-200 px-1 py-1 text-center bg-white outline-none focus:border-indigo-500 font-medium"
                        />
                        <span className="text-slate-400 font-medium">/ {deckCards.length}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => setSelectedDeckId(deck.id)}
                      className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                      Mở thẻ
                    </button>
                    {deckCards.length > 0 && (
                      <button
                        onClick={() => {
                          const limit = studyLimits[deck.id] ? parseInt(studyLimits[deck.id], 10) : deckCards.length;
                          onStudyDeck(deck.id, limit);
                        }}
                        className="flex-1 bg-indigo-50 text-indigo-600 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors flex items-center justify-center"
                      >
                        <Play className="w-4 h-4 mr-1" /> Học
                      </button>
                    )}
                  </div>

                  {/* Nút chia bộ (chỉ cho bộ cha >= 4 thẻ) */}
                  {!isSubDeck && deckCards.length >= 4 && (
                    <button
                      onClick={() => {
                        setSplitParts(3);
                        setSplitModal({ deckId: deck.id, deckName: deck.name, totalCards: deckCards.length });
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      {hasSubDecks ? 'Tráo lại & chia lại' : 'Chia thành nhiều bộ nhỏ'}
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteDeck(deck.id)}
                    className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-full p-1"
                    title="Xóa bộ thẻ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Modal chia bộ thẻ */}
          {splitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Shuffle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Chia bộ thẻ</h3>
                  </div>
                  <button onClick={() => setSplitModal(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-slate-600 mb-1">
                  Bộ <strong className="text-slate-800">{splitModal.deckName}</strong>
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  Tổng {splitModal.totalCards} câu hỏi sẽ được xáo trộn ngẫu nhiên và chia đều vào các bộ nhỏ.
                  Mỗi câu chỉ xuất hiện trong 1 bộ nhỏ duy nhất.
                </p>

                <div className="mb-6">
                  <label className="text-sm font-semibold text-slate-700 block mb-3">Số bộ nhỏ muốn chia:</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={2}
                      max={Math.min(splitModal.totalCards, 10)}
                      value={splitParts}
                      onChange={e => setSplitParts(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))}
                      className="w-20 text-center border-2 border-slate-200 rounded-xl py-3 text-xl font-bold outline-none focus:border-emerald-500 transition-colors"
                    />
                    <div className="flex-1">
                      <div className="flex gap-2">
                        {[2, 3, 4, 5].filter(n => n <= splitModal.totalCards).map(n => (
                          <button
                            key={n}
                            onClick={() => setSplitParts(n)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                              splitParts === n
                                ? 'bg-emerald-500 text-white border-emerald-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview phân phối */}
                  <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Xem trước phân phối:</p>
                    <div className="space-y-1.5">
                      {Array.from({ length: splitParts }, (_, i) => {
                        const chunkSize = Math.ceil(splitModal.totalCards / splitParts);
                        const start = i * chunkSize;
                        const count = Math.min(chunkSize, splitModal.totalCards - start);
                        return count > 0 ? (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-700 w-16">Phần {i + 1}:</span>
                            <div className="flex-1 bg-emerald-100 rounded-full h-2">
                              <div
                                className="bg-emerald-500 rounded-full h-2"
                                style={{ width: `${(count / splitModal.totalCards) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-600 w-12 text-right">{count} câu</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSplitModal(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => handleSplitDeck(splitModal.deckId, splitParts)}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Shuffle className="w-4 h-4" />
                    Xáo & Chia ngay
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    );
  }

  // View: Inside a Deck
  const currentDeck = decks.find(d => d.id === selectedDeckId);
  const deckCards = cards.filter(c => c.deckId === selectedDeckId);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <button 
        onClick={() => { setSelectedDeckId(null); setBulkItems([]); }}
        className="flex items-center text-slate-500 hover:text-slate-800 transition-colors font-medium"
      >
        <ChevronLeft className="w-5 h-5 mr-1" /> Quay lại danh sách bộ
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">
          Bộ: <span className="text-indigo-600">{currentDeck?.name}</span>
        </h2>
        {deckCards.length > 0 && (
          <div className="flex items-center space-x-3 flex-wrap sm:flex-nowrap gap-y-2">
             <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <label className="text-sm text-slate-600 font-medium">Số câu:</label>
                <div className="flex items-center space-x-1">
                  <input 
                     type="number"
                     min="1"
                     max={deckCards.length}
                     value={studyLimits[selectedDeckId] || deckCards.length}
                     onChange={(e) => setStudyLimits(prev => ({...prev, [selectedDeckId]: e.target.value}))}
                     className="w-14 rounded text-center text-sm border border-slate-200 py-1 outline-none focus:border-indigo-500 font-medium"
                  />
                  <span className="text-slate-400 text-sm font-medium">/ {deckCards.length}</span>
                </div>
             </div>
             <button
               onClick={() => {
                 const limit = studyLimits[selectedDeckId] ? parseInt(studyLimits[selectedDeckId], 10) : deckCards.length;
                 onStudyDeck(selectedDeckId, limit);
               }}
               className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
             >
               <Play className="w-4 h-4 mr-2" />
               Học ngay
             </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
          <Plus className="w-5 h-5 mr-2 text-indigo-500" />
          Thêm thẻ mới
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleAddTextCard} className="border border-slate-200 rounded-xl p-6 bg-slate-50 flex flex-col">
            <h4 className="font-semibold text-slate-700 mb-4 flex items-center">
              <Type className="w-4 h-4 mr-2 text-slate-500" /> Thêm thẻ văn bản
            </h4>
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Mặt trước (Câu hỏi / Từ vựng)</label>
                <input 
                  type="text" 
                  value={textQuestion}
                  onChange={e => setTextQuestion(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  placeholder="Nhập nội dung..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Mặt sau (Đáp án)</label>
                <input 
                  type="text" 
                  value={textAnswer}
                  onChange={e => setTextAnswer(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  placeholder="Nhập đáp án chính xác..."
                />
              </div>
            </div>
            <button 
              type="submit"
              className="mt-4 w-full inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Thêm thẻ
            </button>
          </form>

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors relative cursor-pointer group flex flex-col items-center justify-center min-h-[240px]">
            <input 
              type="file" 
              multiple 
              accept="image/*"
              onChange={handleBulkImageUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Chọn nhiều ảnh cùng lúc"
            />
            <div className="flex flex-col items-center justify-center pointer-events-none">
               <ImagePlus className="w-10 h-10 text-slate-300 group-hover:text-indigo-400 transition-colors mb-3" />
               <p className="text-slate-700 font-semibold mb-1">Click / Kéo thả nhiều ảnh</p>
               <p className="text-slate-500 text-xs px-4">Giữ nguyên 100% chất lượng gốc.<br/>Không giới hạn dung lượng.</p>
            </div>
          </div>
        </div>

        {bulkItems.length > 0 && (
          <div className="mt-8">
            <h4 className="font-semibold text-slate-800 mb-4 border-b pb-2">Danh sách ảnh vừa tải lên (Đang chờ thêm đáp án)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bulkItems.map((item, idx) => (
                <div key={item.id} className="flex bg-slate-50 rounded-xl border border-slate-200 overflow-hidden pr-4 relative h-28">
                  <div className="w-28 h-28 bg-slate-200 flex-shrink-0 border-r border-slate-200 p-1 flex items-center justify-center">
                    {/* Dùng object-contain để không xén ảnh */}
                    <img src={item.image} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-center relative">
                    <label className="text-xs font-semibold text-slate-500 mb-1">Đáp án ảnh {idx + 1}</label>
                    <input
                      type="text"
                      value={item.answer}
                      onChange={(e) => handleBulkAnswerChange(item.id, e.target.value)}
                      placeholder="Nhập đáp án chính xác..."
                      className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                      autoFocus={idx === 0}
                    />
                  </div>
                  <button 
                    onClick={() => removeBulkItem(item.id)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveBulkCards}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                Lưu {bulkItems.length} thẻ
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Danh sách thẻ trong bộ ({deckCards.length})</h3>
        {deckCards.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500">Chưa có thẻ nào trong bộ này. Hãy thêm ảnh ở trên!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {deckCards.map((card) => (
              <div key={card.id} className="group relative bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden hover:shadow-md transition-all">
                <div className="aspect-w-4 aspect-h-3 w-full bg-slate-100 h-40 flex items-center justify-center p-2 text-center">
                  {card.image ? (
                    <img src={card.image} alt="Flashcard" className="object-contain w-full h-full" />
                  ) : (
                    <span className="font-semibold text-slate-700 px-2 line-clamp-4">{card.question}</span>
                  )}
                </div>
                <div className="p-4 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-800 truncate" title={card.answer}>
                    {card.answer}
                  </p>
                  <div className="mt-2 flex items-center text-xs text-slate-500 space-x-3">
                    <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Đúng: {card.stats.correct}</span>
                    <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Sai: {card.stats.wrong}</span>
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => handleEditCard(card.id, card.answer)}
                    className="p-2 bg-white/80 backdrop-blur-sm text-indigo-500 rounded-full hover:bg-indigo-50 shadow-sm"
                    title="Sửa đáp án"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="p-2 bg-white/80 backdrop-blur-sm text-red-500 rounded-full hover:bg-red-50 shadow-sm"
                    title="Xóa thẻ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
