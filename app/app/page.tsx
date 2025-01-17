'use client';
import { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface HitData {
  date: string;
  total_hits: number;
  by_states: {
    [key: string]: number;
  }
}

const CACHE_KEY = 'dei-tracker-data';
const CACHE_TIMESTAMP_KEY = 'dei-tracker-timestamp';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export default function Home() {
  const [selectedStates, setSelectedStates] = useState<string[]>(['all']);
  const [data, setData] = useState<HitData[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pieDate, setPieDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const states = ['all', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

  useEffect(() => {
    // Set default dates to last 100 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 100);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setPieDate(end.toISOString().split('T')[0]);

    // Load cached data if available
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (cachedData && cachedTimestamp) {
      const timestamp = parseInt(cachedTimestamp);
      if (Date.now() - timestamp < CACHE_DURATION) {
        setData(JSON.parse(cachedData));
        setIsLoading(false);
      }
    }
  }, []);

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

  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate) return;
      
      try {
        const response = await fetch(
          `https://api.pagin.org/hits?start-date=${startDate}&end-date=${endDate}`
        );
        const jsonData = await response.json();
        setData(jsonData);
        
        // Update dates based on response
        if (jsonData.length > 0) {
          const dates: string[] = jsonData.map((item: { date: string }) => item.date);
          const minDate = dates.reduce((a: string, b: string) => a < b ? a : b);
          const maxDate = dates.reduce((a: string, b: string) => a > b ? a : b);
          setStartDate(minDate);
          setEndDate(maxDate);
          // Update pieDate to be within the new date range
          if (pieDate < minDate || pieDate > maxDate) {
            setPieDate(maxDate);
          }
        }
        setIsLoading(false);
        
        // Cache the new data
        localStorage.setItem(CACHE_KEY, JSON.stringify(jsonData));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

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

  const chartData = data.map(item => {
    const dataPoint: Record<string, number | string> = {
      date: item.date
    };
    
    if (selectedStates.includes('all')) {
      dataPoint.total = item.total_hits;
    } else {
      selectedStates.forEach(state => {
        dataPoint[state] = item.by_states[state] || 0;
      });
    }
    
    return dataPoint;
  });

  const getPieChartData = () => {
    if (!pieDate) return [];
    
    const selectedData = data.find(item => item.date === pieDate);
    if (!selectedData) return [];
    
    if (selectedStates.includes('all')) {
      return Object.entries(selectedData.by_states).map(([state, value]) => ({
        name: state,
        value
      }));
    }
    
    return selectedStates.map(state => ({
      name: state,
      value: selectedData.by_states[state] || 0
    }));
  };

  const pieData = getPieChartData();
  const totalPieValue = pieData.reduce((sum, entry) => sum + entry.value, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          DEI Tracker
        </h1>
        <p className="text-gray-600 text-center mb-8 text-lg">
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
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full md:w-auto border border-gray-300 bg-white rounded p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex-1">
              <label className="block mb-2 text-gray-700">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full md:w-auto border border-gray-300 bg-white rounded p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="relative w-full md:w-auto" ref={dropdownRef}>
            <label className="block mb-2 text-gray-700">States:</label>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full md:w-auto border border-gray-300 rounded p-2 bg-white hover:bg-gray-50 flex items-center justify-between gap-2 text-gray-700"
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

        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Hits Over Time
          </h2>
          
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  stroke="#374151"
                />
                <YAxis stroke="#374151" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px'
                  }}
                  labelStyle={{ color: '#374151' }}
                />
                <Legend />
                {selectedStates.includes('all') ? (
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="All States"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#2563eb' }}
                  />
                ) : (
                  selectedStates.map((state, index) => (
                    <Line
                      key={state}
                      type="monotone"
                      dataKey={state}
                      stroke={`hsl(${(index * 137.5) % 360}, 70%, 45%)`}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            State Distribution
          </h2>
          <div className="mb-4">
            <label className="block mb-2 text-gray-700">Select Date:</label>
            <input
              type="date"
              value={pieDate}
              min={startDate}
              max={endDate}
              onChange={(e) => {
                const selectedDate = e.target.value;
                if (selectedDate >= startDate && selectedDate <= endDate) {
                  setPieDate(selectedDate);
                }
              }}
              className="w-full md:w-auto border border-gray-300 bg-white rounded p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="h-[900px] md:h-[600px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent, name }) => 
                    percent > 0.05 ? `${name}: ${(percent * 100).toFixed(2)}%` : null
                  }
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={`hsl(${(index * 137.5) % 360}, 70%, 45%)`}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${name}: ${((value / totalPieValue) * 100).toFixed(2)}%`,
                    `Value: ${value}`
                  ]}
                  active={true}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
