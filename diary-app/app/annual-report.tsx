import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** 年度报告已并入「回顾 · 年」：旧链接直接跳到对应年份 */
export default function AnnualReportRedirect() {
  const { year } = useLocalSearchParams<{ year?: string }>();
  return <Redirect href={{ pathname: '/review', params: year ? { scope: 'year', year } : { scope: 'year' } }} />;
}
