
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import confetti from "canvas-confetti";

// --- CONFIGURACIÓN Y ESTADO ---
// Added type casting to avoid implicit never[] and null issues
const state = {
  participants: [] as any[],
  winner: null as any,
  status: 'IDLE', // IDLE, READY, COUNTING, WINNER
  backgroundImage: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=2070',
  countdown: 10,
  hypeMessage: ''
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- LÓGICA DE IA ---
// Added type for winnerName parameter
async function fetchHypeMessage(winnerName: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Genera un mensaje de 8 palabras máximo celebrando que ${winnerName} ganó un sorteo. Sé muy entusiasta.`,
    });
    // Property .text is the correct way to extract text output from response
    state.hypeMessage = response.text || "¡Felicidades al nuevo campeón!";
  } catch (e) {
    state.hypeMessage = "¡Muchas felicidades por este gran premio!";
  }
  render();
}

// --- UTILIDADES DE EXCEL ---
// Added type for str parameter
const normalize = (str: string | number) => 
  String(str).toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .trim();

// Added types for findValue arguments
function findValue(row: any, options: string[]) {
  const keys = Object.keys(row);
  for (const opt of options) {
    const normOpt = normalize(opt);
    const found = keys.find(k => normalize(k) === normOpt);
    if (found) return row[found];
  }
  return null;
}

// --- ACCIONES ---
// Added type for the event parameter e
function onFileUpload(e: any) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt: any) => {
    const data = XLSX.read(evt.target.result, { type: 'binary' });
    const sheet = data.Sheets[data.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    state.participants = rows.map(row => ({
      name: String(findValue(row, ['Nombre y Apellido', 'Nombre', 'Participante']) || 'Anónimo'),
      pdv: String(findValue(row, ['Código del pdv', 'Codigo del pdv', 'PDV', 'Codigo']) || 'N/A'),
      weight: parseInt(findValue(row, ['posibiliades de ganar', 'oportunidades', 'peso']) || 1, 10)
    }));

    if (state.participants.length > 0) {
      state.status = 'READY';
      render();
    }
  };
  reader.readAsBinaryString(file);
}

function startSorteo() {
  const pool: any[] = [];
  state.participants.forEach(p => {
    for(let i=0; i<p.weight; i++) pool.push(p);
  });

  state.winner = pool[Math.floor(Math.random() * pool.length)];
  state.status = 'COUNTING';
  state.countdown = 10;
  state.hypeMessage = '';
  render();

  const interval = setInterval(() => {
    state.countdown--;
    if (state.countdown <= 0) {
      clearInterval(interval);
      state.status = 'WINNER';
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.7 } });
      fetchHypeMessage(state.winner.name);
    }
    render();
  }, 1000);
}

// --- RENDERIZADO ---
function render() {
  const container = document.getElementById('bg-container');
  const content = document.getElementById('app-content');
  
  // Safe access to container element
  if (container) {
    container.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(${state.backgroundImage})`;
  }

  let html = '';

  // Botones de configuración
  const toolbar = `
    <div class="absolute top-6 right-6 flex gap-4 z-50">
      <button onclick="document.getElementById('bg-input').click()" class="bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-2 rounded-full text-xs font-bold border border-white/20 transition-all uppercase tracking-widest">
        🖼️ Cambiar Fondo
      </button>
      <input type="file" id="bg-input" class="hidden" accept="image/*" onchange="window.updateBg(event)">
      ${state.status !== 'IDLE' ? `
        <button onclick="window.resetApp()" class="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md px-5 py-2 rounded-full text-xs font-bold border border-red-500/20 transition-all uppercase tracking-widest">
          🔄 Reiniciar
        </button>
      ` : ''}
    </div>
  `;

  if (state.status === 'IDLE') {
    html = `
      <div class="text-center p-16 rounded-[3rem] glass max-w-2xl w-full mx-4 animate-reveal">
        <h1 class="text-7xl font-brand mb-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 bg-clip-text text-transparent uppercase tracking-tighter">
          SORTEADOR
        </h1>
        <p class="text-gray-400 mb-12 text-xl font-light">Sube tu archivo de Excel para comenzar la experiencia.</p>
        <button onclick="document.getElementById('excel-input').click()" class="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl transition-all shadow-xl shadow-indigo-600/20 uppercase tracking-widest">
          📁 Seleccionar Excel
        </button>
        <input type="file" id="excel-input" class="hidden" accept=".xlsx, .xls" onchange="window.handleExcel(event)">
        <div class="mt-10 grid grid-cols-3 gap-4 opacity-40">
           <div class="text-[10px] uppercase tracking-tighter">Nombre y Apellido</div>
           <div class="text-[10px] uppercase tracking-tighter">Código del PDV</div>
           <div class="text-[10px] uppercase tracking-tighter">Posibilidades</div>
        </div>
      </div>
    `;
  } else if (state.status === 'READY') {
    html = `
      <div class="text-center animate-reveal">
        <div class="p-16 rounded-[4rem] glass flex flex-col items-center">
          <div class="text-9xl mb-8 animate-bounce">💎</div>
          <h2 class="text-5xl font-brand mb-2">¡BASE CARGADA!</h2>
          <p class="text-2xl text-gray-400 mb-12">Detectamos <span class="text-yellow-400 font-bold">${state.participants.length}</span> participantes listos.</p>
          <button onclick="window.initSorteo()" class="px-20 py-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl text-4xl font-black text-white shadow-[0_0_50px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
            ¡EMPEZAR!
          </button>
        </div>
      </div>
    `;
  } else if (state.status === 'COUNTING') {
    html = `
      <div class="text-center">
        <div class="text-[22rem] font-brand leading-none text-white drop-shadow-[0_0_60px_rgba(255,255,255,0.4)] animate-count" key="${state.countdown}">
          ${state.countdown}
        </div>
        <p class="text-5xl font-bold tracking-[0.5em] text-yellow-500 animate-pulse mt-10 uppercase">
          Buscando Ganador
        </p>
      </div>
    `;
  } else if (state.status === 'WINNER') {
    html = `
      <div class="text-center max-w-6xl px-8 animate-reveal">
        <div class="p-20 rounded-[5rem] glass border-4 border-yellow-500/50 shadow-[0_0_100px_rgba(234,179,8,0.2)]">
          <h4 class="text-4xl font-bold text-yellow-500 mb-10 tracking-[0.4em] uppercase">¡Tenemos un Ganador!</h4>
          <h1 class="text-8xl md:text-[10rem] font-brand mb-8 leading-none text-white drop-shadow-2xl">
            ${state.winner?.name}
          </h1>
          <div class="inline-block bg-yellow-500 text-black px-12 py-4 rounded-3xl text-3xl font-black mb-12 shadow-xl">
            PDV: ${state.winner?.pdv}
          </div>
          ${state.hypeMessage ? `
            <p class="text-4xl italic text-gray-200 font-light mt-4">"${state.hypeMessage}"</p>
          ` : '<div class="h-10"></div>'}
          <div class="mt-16">
            <button onclick="window.backToReady()" class="px-12 py-5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl border border-white/20 transition-all uppercase tracking-widest">
              Nuevo Ganador
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Safe access to content element
  if (content) {
    content.innerHTML = toolbar + html;
  }
}

// --- EXPOSICIÓN GLOBAL PARA HTML ---
// Cast window to any to allow assigning custom properties used in HTML event handlers
(window as any).handleExcel = onFileUpload;
(window as any).initSorteo = startSorteo;
(window as any).resetApp = () => { state.status = 'IDLE'; state.participants = []; render(); };
(window as any).backToReady = () => { state.status = 'READY'; state.winner = null; render(); };
(window as any).updateBg = (e: any) => {
  const file = e.target.files?.[0];
  if (file) {
    state.backgroundImage = URL.createObjectURL(file);
    render();
  }
};

// Inicio
render();
