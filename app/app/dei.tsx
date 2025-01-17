'use client';

import { useState, useEffect, useRef } from 'react';
import LineChartComponent from './line_chart';
import PieChartComponent from './pie_chart';
import { states, HitData } from './model';

interface DEIPageProps {
  data: HitData[];
  startDate: string;
  endDate: string;
}

export default function DEIPage({ data: initialData, startDate: initialStartDate, endDate: initialEndDate }: DEIPageProps) {
  const [selectedStates, setSelectedStates] = useState<string[]>(['all']);
  const [pieDate, setPieDate] = useState(initialEndDate);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(initialData);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStateChange = (state: string) => {
    setSelectedStates(prev => {
      if (state === 'all') {
        return ['all'];
      }
      
      const newStates = prev.filter(s => s !== 'all');
      if (newStates.includes(state)) {
        return newStates.filter(s => s !== state);
      } else {
        return [...newStates, state];
      }
    });
  };

  const resetStates = () => {
    setSelectedStates(['all']);
    setIsDropdownOpen(false);
  };

  const fetchData = async (start: string, end: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.pagin.org/hits?start-date=${start}&end-date=${end}`
      );
      const jsonData = await response.json();
      
      let finalStartDate = start;
      let finalEndDate = end;
      
      if (jsonData.length > 0) {
        const dates: string[] = jsonData.map((item: { date: string }) => item.date);
        finalStartDate = dates.reduce((a: string, b: string) => a < b ? a : b);
        finalEndDate = dates.reduce((a: string, b: string) => a > b ? a : b);
      }

      setData(jsonData);
      setStartDate(finalStartDate);
      setEndDate(finalEndDate);
      setPieDate(finalEndDate);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = async (type: 'start' | 'end', date: string) => {
    if (type === 'start') {
      if (date > endDate) return;
      setStartDate(date);
    } else {
      if (date < startDate) return;
      setEndDate(date);
    }
    await fetchData(
      type === 'start' ? date : startDate,
      type === 'end' ? date : endDate
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          DEI Tracker
        </h1>
        <p className="text-gray-600 text-center mb-12 text-lg">
          This dashboard tracks the number of LinkedIn profiles containing DEI (Diversity, Equity, and Inclusion) 
          keywords in their descriptions across different states in the United States. The data helps visualize 
          the geographic distribution and trends of DEI professionals over time.
        </p>
        
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="w-full md:w-auto flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <label className="block mb-2 text-gray-700">Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="w-full md:w-auto border border-gray-300 bg-white rounded p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            
            <div className="flex-1">
              <label className="block mb-2 text-gray-700">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="w-full md:w-auto border border-gray-300 bg-white rounded p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="relative w-full md:w-auto" ref={dropdownRef}>
            <label className="block mb-2 text-gray-700">States:</label>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full md:w-auto border border-gray-300 rounded p-2 bg-white hover:bg-gray-50 flex items-center justify-between gap-2 text-gray-700"
              disabled={isLoading}
            >
              <span>States: {selectedStates.includes('all') ? 'All' : selectedStates.length}</span>
              <span className="text-xs">▼</span>
            </button>
            
            {isDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full md:w-64 bg-white border border-gray-300 rounded shadow-lg">
                <div className="p-2 border-b border-gray-200 flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Select States</span>
                  <button 
                    onClick={resetStates}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Reset
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {states.map(state => (
                    <div key={state} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id={state}
                        checked={selectedStates.includes(state)}
                        onChange={() => handleStateChange(state)}
                        className="accent-blue-500"
                        disabled={isLoading}
                      />
                      <label htmlFor={state} className="text-gray-700 hover:text-gray-900">
                        {state === 'all' ? 'All States' : state}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <LineChartComponent 
              data={data}
              selectedStates={selectedStates}
            />

            <PieChartComponent
              data={data}
              selectedStates={selectedStates}
              pieDate={pieDate}
              startDate={startDate}
              endDate={endDate}
              setPieDate={setPieDate}
            />
          </>
        )}
      </div>
    </div>
  );
}