'use server'

import DEIPage from './dei';

async function getData() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 100);
  
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  try {
    const response = await fetch(
      `https://api.pagin.org/hits?start-date=${startDate}&end-date=${endDate}`
    );
    const jsonData = await response.json();
    
    let finalStartDate = startDate;
    let finalEndDate = endDate;
    
    if (jsonData.length > 0) {
      const dates: string[] = jsonData.map((item: { date: string }) => item.date);
      finalStartDate = dates.reduce((a: string, b: string) => a < b ? a : b);
      finalEndDate = dates.reduce((a: string, b: string) => a > b ? a : b);
    }

    return {
      data: jsonData,
      startDate: finalStartDate,
      endDate: finalEndDate
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      data: [],
      startDate,
      endDate
    };
  }
}

export default async function Home() {
  const { data, startDate, endDate } = await getData();

  return (
    <DEIPage 
      data={data}
      startDate={startDate}
      endDate={endDate}
    />
  );
}
