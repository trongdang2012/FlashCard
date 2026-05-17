import React, { useState, useEffect } from 'react';
import { ImagePlus, Trash2, Save, Plus, Folder, ChevronLeft, Play, LayoutGrid, Download, Upload } from 'lucide-react';
import { get, set } from 'idb-keyval';

export default function CardEditor({ onStudyDeck }) {
  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  
  // Bulk upload state
  const [bulkItems, setBulkItems] = useState([]);

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
    const name = prompt('Nhập tên bộ thẻ mới:');
    if (name && name.trim()) {
      const newDeck = { id: Date.now().toString(), name: name.trim(), lastStudiedIndex: 0, isCompleted: false };
      const updatedDecks = [...decks, newDeck];
      await set('microdecks', updatedDecks);
      setDecks(updatedDecks);
    }
  };

  const handleDeleteDeck = async (id) => {
    if (window.confirm('Bạn có chắc muốn xóa bộ thẻ này và toàn bộ thẻ bên trong?')) {
      const updatedDecks = decks.filter(d => d.id !== id);
      const updatedCards = cards.filter(c => c.deckId !== id);
      await set('microdecks', updatedDecks);
      await set('microcards', updatedCards);
      setDecks(updatedDecks);
      setCards(updatedCards);
    }
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

  const removeBulkItem = (id) => {
    setBulkItems(prev => prev.filter(item => item.id !== id));
  };

  const saveBulkCards = async () => {
    const invalidItems = bulkItems.filter(i => !i.answer.trim());
    if (invalidItems.length > 0) {
      alert('Vui lòng nhập đáp án cho tất cả các ảnh trước khi lưu!');
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
      alert('Không thể lưu thẻ: ' + err.message);
    }
  };

  const handleDeleteCard = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa thẻ này?')) {
      const updatedCards = cards.filter(c => c.id !== id);
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
      alert('Có lỗi khi xuất dữ liệu: ' + error.message);
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
          if (window.confirm(`Tìm thấy ${data.decks.length} bộ thẻ và ${data.cards.length} thẻ. Bạn có chắc chắn muốn nạp dữ liệu này? (Dữ liệu mới sẽ được gộp vào dữ liệu hiện tại)`)) {
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
            alert('Nhập dữ liệu thành công!');
          }
        } else {
          alert('File không hợp lệ hoặc bị hỏng.');
        }
      } catch (error) {
        alert('Lỗi đọc file: ' + error.message);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map(deck => {
              const deckCards = cards.filter(c => c.deckId === deck.id);
              return (
                <div key={deck.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-800 truncate pr-4" title={deck.name}>{deck.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">{deckCards.length} thẻ</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Folder className="w-5 h-5 text-indigo-500" />
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setSelectedDeckId(deck.id)}
                      className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                      Mở thẻ
                    </button>
                    {deckCards.length > 0 && (
                      <button
                        onClick={() => onStudyDeck(deck.id)}
                        className="flex-1 bg-indigo-50 text-indigo-600 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors flex items-center justify-center"
                      >
                        <Play className="w-4 h-4 mr-1" /> Học
                      </button>
                    )}
                  </div>

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
          <button
            onClick={() => onStudyDeck(selectedDeckId)}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <Play className="w-4 h-4 mr-2" />
            Học ngay
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
          <ImagePlus className="w-5 h-5 mr-2 text-indigo-500" />
          Thêm thẻ mới (Hỗ trợ thêm nhiều ảnh cùng lúc)
        </h3>
        
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors relative cursor-pointer group">
          <input 
            type="file" 
            multiple 
            accept="image/*"
            onChange={handleBulkImageUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            title="Chọn nhiều ảnh cùng lúc"
          />
          <div className="flex flex-col items-center justify-center pointer-events-none">
             <ImagePlus className="w-12 h-12 text-slate-300 group-hover:text-indigo-400 transition-colors mb-4" />
             <p className="text-slate-700 font-semibold mb-1">Click hoặc Kéo thả nhiều ảnh vào đây</p>
             <p className="text-slate-500 text-sm">Giữ nguyên 100% chất lượng gốc. Không giới hạn dung lượng lưu trữ.</p>
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
                <div className="aspect-w-4 aspect-h-3 w-full bg-slate-100 h-40 flex items-center justify-center p-2">
                  {/* Sửa lại object-cover thành object-contain */}
                  <img src={card.image} alt="Microscopic" className="object-contain w-full h-full" />
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
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shadow-sm"
                  title="Xóa thẻ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
