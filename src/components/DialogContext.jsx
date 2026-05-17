import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

const DialogContext = createContext();

export const useDialog = () => useContext(DialogContext);

export const DialogProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);
  const inputRef = useRef(null);

  const showDialog = useCallback((type, title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      setDialog({ type, title, message, defaultValue, resolve });
    });
  }, []);

  const alert = useCallback((message, title = 'Thông báo') => showDialog('alert', title, message), [showDialog]);
  const confirm = useCallback((message, title = 'Xác nhận') => showDialog('confirm', title, message), [showDialog]);
  const prompt = useCallback((message, defaultValue = '', title = 'Nhập thông tin') => showDialog('prompt', title, message, defaultValue), [showDialog]);

  const handleClose = (result) => {
    if (dialog?.resolve) dialog.resolve(result);
    setDialog(null);
  };

  useEffect(() => {
    if (dialog?.type === 'prompt' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [dialog]);

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden relative"
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-center mb-5">
                  {dialog.type === 'alert' && <AlertCircle className="w-8 h-8 text-indigo-500 mr-3 shrink-0" />}
                  {dialog.type === 'confirm' && <HelpCircle className="w-8 h-8 text-amber-500 mr-3 shrink-0" />}
                  {dialog.type === 'prompt' && <CheckCircle className="w-8 h-8 text-emerald-500 mr-3 shrink-0" />}
                  <h3 className="text-xl font-bold text-slate-800">{dialog.title}</h3>
                </div>
                
                <p className="text-slate-600 mb-6 whitespace-pre-wrap leading-relaxed text-base">{dialog.message}</p>
                
                {dialog.type === 'prompt' && (
                  <input
                    type="text"
                    ref={inputRef}
                    defaultValue={dialog.defaultValue}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-slate-800 font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleClose(e.target.value);
                      if (e.key === 'Escape') handleClose(null);
                    }}
                  />
                )}

                <div className="flex justify-end space-x-3 mt-2">
                  {dialog.type !== 'alert' && (
                    <button
                      onClick={() => handleClose(null)}
                      className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95"
                    >
                      Hủy bỏ
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (dialog.type === 'prompt') {
                        handleClose(inputRef.current.value);
                      } else {
                        handleClose(true);
                      }
                    }}
                    className="px-6 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm shadow-indigo-200 active:scale-95"
                  >
                    {dialog.type === 'alert' ? 'Đóng' : 'Xác nhận'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};
