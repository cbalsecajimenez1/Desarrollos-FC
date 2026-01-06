
import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { AppStatus, Participant, RaffleState } from './types';
import { GoogleGenAI } from "@google/genai";
import confetti from 'canvas-confetti';

const App: React.FC = () => {
  const [state, setState] = useState<RaffleState>({
    participants: [],
    winner: null,
    status: AppStatus.IDLE,
    backgroundImage: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=2070',
  });

  const [countdown, setCountdown] = useState(10);
  const [hypeMessage, setHypeMessage] = useState<string>('');
  const bgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateHypeMessage = async (winnerName: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Genera un mensaje corto y emocionante de felicitación para un ganador llamado ${winnerName}. Máximo 10 palabras.`,
      });
      setHypeMessage(response.text || '¡Muchas felicidades por tu victoria!');
    } catch (error) {
      console.error("Gemini error:", error);
      setHypeMessage('¡Felicidades al afortunado ganador!');
    }
  };

  // Función para buscar un valor en el objeto de la fila ignorando acentos y mayúsculas
  const getFlexibleValue = (row: any, searchKeys: string[]) => {
    const rowKeys = Object.keys(row);
    
    const normalize = (str: string) => 
      str.toLowerCase()
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .trim();

    for (const searchKey of searchKeys) {
      const normalizedSearch = normalize(searchKey);
      const foundKey = rowKeys.find(rk => normalize(rk) === normalizedSearch);
      if (foundKey) return row[foundKey];
    }
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        const parsed: Participant[] = data.map((row: any) => {
          const name = getFlexibleValue(row, ['Nombre y Apellido', 'Nombre', 'Participante']) || 'Sin nombre';
          const pdvCode = getFlexibleValue(row, ['Código del pdv', 'Codigo del pdv', 'Codigo pdv', 'PDV', 'Codigo']) || 'N/A';
          const opps = getFlexibleValue(row, ['posibiliades de ganar', 'posibilidades', 'oportunidades', 'chances']) || '1';

          return {
            name: String(name),
            pdvCode: String(pdvCode),
            opportunities: parseInt(String(opps), 10) || 1
          };
        });

        if (parsed.length > 0) {
          setState(prev => ({
            ...prev,
            participants: parsed,
            status: AppStatus.READY
          }));
        } else {
          alert("No se encontraron datos válidos en el archivo.");
        }
      } catch (err) {
        console.error("Error al procesar el Excel:", err);
        alert("Error al leer el archivo. Asegúrate de que sea un Excel válido.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setState(prev => ({ ...prev, backgroundImage: url }));
  };

  const startRaffle = () => {
    if (state.participants.length === 0) return;

    const pool: Participant[] = [];
    state.participants.forEach(p => {
      for (let i = 0; i < p.opportunities; i++) {
        pool.push(p);
      }
    });

    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedWinner = pool[randomIndex];

    setState(prev => ({ ...prev, status: AppStatus.COUNTING, winner: selectedWinner }));
    setCountdown(10);
    setHypeMessage('');
  };

  useEffect(() => {
    let timer: any;
    if (state.status === AppStatus.COUNTING && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (state.status === AppStatus.COUNTING && countdown === 0) {
      setState(prev => ({ ...prev, status: AppStatus.WINNER }));
      if (state.winner) {
        generateHypeMessage(state.winner.name);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
    return () => clearTimeout(timer);
  }, [state.status, countdown, state.winner]);

  const reset = () => {
    setState(prev => ({ ...prev, status: AppStatus.IDLE, winner: null, participants: [] }));
    setHypeMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden flex items-center justify-center text-white bg-cover bg-center transition-all duration-700"
      style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${state.backgroundImage})` }}
    >
      <div className="absolute top-6 right-6 flex gap-4 z-50">
        <button 
          onClick={() => bgInputRef.current?.click()}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium border border-white/20 transition-all flex items-center gap-2"
        >
          🖼️ Fondo
        </button>
        <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
        
        {state.status !== AppStatus.IDLE && (
          <button 
            onClick={reset}
            className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium border border-red-500/30 transition-all"
          >
            🔄 Nuevo Sorteo
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {state.status === AppStatus.IDLE && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center p-12 rounded-[2.5rem] backdrop-blur-xl bg-black/40 border border-white/10 shadow-2xl max-w-2xl w-full mx-4"
          >
            <h1 className="text-6xl font-brand mb-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent uppercase tracking-tighter">
              Sorteador Pro
            </h1>
            <p className="text-gray-300 mb-10 text-lg">Carga el Excel con los participantes para comenzar.</p>
            
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-2xl hover:bg-indigo-700 w-full shadow-lg shadow-indigo-500/30"
              >
                📁 Subir Archivo Excel
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
              
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 w-full">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-2">Columnas Recomendadas:</p>
                <div className="flex justify-around text-xs text-gray-300">
                  <span>• Nombre y Apellido</span>
                  <span>• Código del PDV</span>
                  <span>• Posibilidades</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {state.status === AppStatus.READY && (
          <motion.div 
            key="ready"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="p-12 rounded-[3rem] backdrop-blur-2xl bg-white/5 border border-white/10 shadow-2xl flex flex-col items-center">
              <div className="mb-8 text-8xl animate-pulse">🏆</div>
              <h2 className="text-5xl font-brand mb-4">¡LISTOS PARA EMPEZAR!</h2>
              <p className="text-2xl text-gray-300 mb-10">
                <span className="text-yellow-400 font-bold">{state.participants.length}</span> registros cargados correctamente.
              </p>
              <button 
                onClick={startRaffle}
                className="animate-bounce inline-flex items-center justify-center px-16 py-8 text-3xl font-black uppercase tracking-widest text-white transition-all duration-300 bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl shadow-[0_0_60px_rgba(16,185,129,0.4)] hover:scale-110 active:scale-95 border-b-8 border-emerald-800"
              >
                ¡VAMOS A JUGAR!
              </button>
            </div>
          </motion.div>
        )}

        {state.status === AppStatus.COUNTING && (
          <motion.div 
            key="counting"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="relative">
               <motion.div 
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[18rem] font-brand leading-none select-none text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.6)]"
               >
                {countdown}
               </motion.div>
               <div className="mt-8 space-y-2">
                <p className="text-4xl font-bold tracking-[0.4em] text-yellow-400 animate-pulse">
                  SORTEANDO...
                </p>
                <div className="w-64 h-2 bg-white/10 rounded-full mx-auto overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-1/2 h-full bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
                  />
                </div>
               </div>
            </div>
          </motion.div>
        )}

        {state.status === AppStatus.WINNER && state.winner && (
          <motion.div 
            key="winner"
            initial={{ scale: 0.8, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            className="text-center max-w-5xl px-4"
          >
            <div className="p-16 rounded-[4rem] backdrop-blur-3xl bg-black/40 border-4 border-yellow-400 shadow-[0_0_150px_rgba(255,223,0,0.3)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-4xl font-bold text-yellow-400 mb-8 uppercase tracking-[0.3em]">
                  ¡FELICIDADES!
                </h3>
                <h1 className="text-7xl md:text-9xl font-brand mb-6 leading-tight text-white drop-shadow-lg">
                  {state.winner.name}
                </h1>
                
                <div className="flex justify-center items-center gap-6 mb-10">
                  <span className="bg-yellow-400 text-black px-10 py-3 rounded-2xl text-2xl font-black border-2 border-yellow-200 shadow-lg">
                    PDV: {state.winner.pdvCode}
                  </span>
                </div>

                {hypeMessage && (
                   <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-3xl italic text-gray-100 font-light max-w-2xl mx-auto"
                   >
                    "{hypeMessage}"
                   </motion.p>
                )}
                
                <div className="mt-14 flex justify-center gap-4">
                  <button 
                    onClick={() => setState(prev => ({ ...prev, status: AppStatus.READY, winner: null }))}
                    className="px-10 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all border border-white/20"
                  >
                    Nuevo Ganador
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-8 left-10 text-white/30 text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-4">
        <div className="flex gap-1">
          <div className="w-1 h-4 bg-yellow-400/50 rounded-full" />
          <div className="w-1 h-4 bg-yellow-400/50 rounded-full" />
          <div className="w-1 h-4 bg-yellow-400/50 rounded-full" />
        </div>
        Sistema de Sorteos Aleatorios con Pesos
      </div>
    </div>
  );
};

export default App;
