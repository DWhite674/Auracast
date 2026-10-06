'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, ShieldCheck, Activity } from 'lucide-react';


import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface TimelineItem {
  time: string;
  pressure_hpa: number;
  drop_hpa: number;
  risk_level: 'LOW' | 'Medium' | 'High';
}

export function PressureChart({ data }: { data: TimelineItem[] }) {
  const chartData = data.map((item) => ({
    ...item,
    timestamp: new Date(item.time).getTime(),
    formattedTime: new Date(item.time).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }));


  const pressures = data.map((d) => d.pressure_hpa);
  const minP = Math.floor(Math.min(...pressures, 1000) - 2 );
  const maxP = Math.ceil(Math.max(...pressures, 1015) + 2 );

  return (  
    <div className="w-full h-64 bg-[#1a1726] border border-[#2e2842] rounded-xl p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e2842" vertical={false} />

          <XAxis 
            dataKey="timestamp" 
            type="number" 
            domain={['dataMin', 'dataMax']} 
            stroke="#a78bfa" 
            tick={{ fontSize: 11 }} 
            tickFormatter={(time) => 
              new Date(time).toLocaleTimeString([], { 
                hour: 'numeric', 
                minute: '2-digit' 
                })
              }
            />

          <YAxis domain={[minP, maxP]} stroke="#a78bfa" tick={{ fontSize: 11 }} unit=" hPa" width={70} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-[#13111c] border border-[#2e2842] p-2.5 rounded-lg text-xs text-violet-100">
                    <p className="font-mono text-violet-300">{item.formattedTime}</p>
                    <p className="font-semibold">{item.pressure_hpa} hPa</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="pressure_hpa"
            stroke="#c4b5fd"
            strokeWidth={2}
            fill="url(#purpleGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


export default function Home(){
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [warnings, setWarnings] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'12hr' | '24hr' | '48hr'>('12hr');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  

  const options: ('12hr' | '24hr' | '48hr')[] = ['12hr', '24hr', '48hr'];

  //fetch data from local FastAPI backend on component load
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
    axios
      .get(`${baseUrl}/api/risk?lat=45.4215&lon=-75.6972&sensitivity=2.5`)
      .then((res) => {
        setTimeline(res.data.timeline || []);  
        setWarnings(res.data.total_warnings || 0);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setTimeline([]);
        setLoading(false);
      }); 
    }, []);

  //slice the 48-hr timeline into 24-hr and 12hr
  const getfilteredTimeline = () => {
    const currentHour = new Date().getHours();

    if (activeTab === '12hr') {
      return timeline.slice(currentHour, currentHour + 12);
    }
    if (activeTab === '24hr') return timeline.slice(0, 24);
    return timeline.slice(0, 48);
  }

  const filteredTimeline = getfilteredTimeline();

  const activeTabWarningCount = filteredTimeline.filter(
    (item) => item.risk_level === 'Medium' || item.risk_level === 'High').length;  

  //helper renderer funciton for timeline cards
  const renderTimelineCard = (item: TimelineItem[], is12HrMode: boolean) => {
    const now = new Date();


    const baseTime = is12HrMode
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    return item.map((cardItem, index) => {
      //increment hr by hr
      const itemDate = new Date(baseTime);
      itemDate.setHours(itemDate.getHours() + index);

      const isCurrentHour = itemDate.getHours() === now.getHours() && itemDate.getDate() === now.getDate();

      const isHigh = cardItem.risk_level === 'High';
      const isMed = cardItem.risk_level === 'Medium';

      let cardStyle = 'bg-slate-800 border-slate-700 text-slate-300';
      if (isHigh) {
        cardStyle = 'bg-rose-950/40 border-rose-500/50 text-rose-100';
      } else if (isMed) {
        cardStyle = 'bg-amber-950/40 border-amber-500/50 text-amber-100';
      } else if (isCurrentHour) {
        cardStyle = 'bg-slate-800 border-teal-500 text-slate-100 ring-1 ring-teal-500/50';
      }
          
      // Badge styling
      let badgeStyle = 'bg-slate-700 text-slate-300';
      if (isHigh) {
        badgeStyle = 'bg-rose-500 text-white';
      } else if (isMed) {
        badgeStyle = 'bg-amber-500 text-slate-950';
      } else if (isCurrentHour) {
        badgeStyle = 'bg-teal-500 text-slate-950';
      }
          
      return (
        <div 
          key={index}
          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${cardStyle}`}
        >
          {/* Left Column: Icon + Time + Pressure */}
          <div className = "flex items-center gap-4">
            {isHigh || isMed ? (
              <AlertTriangle className={isHigh ? 'text-rose-400' : 'text-amber-400'}/>
            ) : (
              <ShieldCheck className={isCurrentHour ? 'text-emerald-400' : 'text-slate-500'}/>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm">
                  {itemDate.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</p>
              </div>
            <p className="text-xs text-slate-400">Pressure: {cardItem.pressure_hpa} hPa</p>
            </div>
          </div>
            
          {/* Right Column: Risk Level + Drop */}
          <div className="text-right">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${badgeStyle}`}
            >
              {cardItem.risk_level}
            </span>
            <p className="text-xs font-mono mt-1 text-slate-400">
              Drop: {cardItem.drop_hpa} hPa
            </p>
          </div>
        </div>
      );
      });
  };

  if (loading) {
    return <div className="min-h-screen bg-[#13111c] text-indigo-400 flex items-center justify-center "> Loading data...</div>;
  }

  return (
    <main className="min-h-screen bg-[#13111c] text-indigo-100 p-6 max-w-screen mx-full">
      
      {/* Header Section*/}
      <header className="flex items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-teal-400 flex items-center gap-2">
            <Activity /> Auracast
          </h1>
          <p className="text-slate-400 text-sm">Barometric Pressure Headache Tracker</p>
        </div>

        <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 ml-auto translate-x-[-10px]">
          <span className="text-xs text-slate-600 uppercase tracking-wider block">Active Warnings</span>
          <span className={`text-xl font-bold ${activeTabWarningCount > 2 ? 'text-rose-400' : activeTabWarningCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {activeTabWarningCount} Warnings</span>
        </div>
        {/* Log In Button */}
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-700/80 transition-colors">
            <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider block">
              Log In
            </span>
          </div>
      </header>

      {/* Main body layout*/}
      <div className="flex gap-8 items-start">
        {/* Dropdown menu selector + Sidebar Nav*/}
        
        <aside className="w-32 flex-shrink-0 sticky top-6"> 
          <div className="relative inline-block ml-6 z-50">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex flex-col gap-1 p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer transition-colors"
            title="select forecast range"
            >
              <div className="w-5 h-0.5 bg-teal-400" />
              <div className="w-5 h-0.5 bg-teal-400" />
              <div className="w-5 h-0.5 bg-teal-400" />
            </button>

            {isOpen && (
              <ul className="absolute top-full left-0 mt-2 p-0 list-none border border-slate-700 bg-slate-800 rounded-lg shadow-lg min-w-[120px]">
                {options.map((option, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      setActiveTab(option);
                      setIsOpen(false);
                    }}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-slate-700 ${
                      activeTab === option 
                      ? 'bg-teal-500/20 text-teal-300 font-bold' 
                      : 'text-slate-300'
                    }`}
                  >
                    {option === '12hr' ? '12-Hours' : option === '24hr' ? '24-Hour' : '48-Hour'}
                  </li>
                ))}
              </ul>
            )}
        </div>  
        </aside>

        {/* Main Content Column */}
        <div className="flex-1 flex flex-col gap-8 max-w-6xl">
          {/* Top Section: Header & Graph */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-slate-300">
              {activeTab === '12hr'
                ? 'Upcoming 12-Hours'
                : activeTab === '24hr'
                ? '24-Hour Forecast'
                : '48-Hour Forecast'}
            </h2>
            <PressureChart data={filteredTimeline} />
          </div>            
        {/* Timeline Cards */}
        <div className="flex flex-col gap-4">
            {renderTimelineCard(filteredTimeline, activeTab === '12hr')}
        </div>
        </div>
      </div>
    </main>
  );
}
