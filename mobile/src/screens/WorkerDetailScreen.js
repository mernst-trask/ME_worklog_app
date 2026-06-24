import React from 'react';
import CalendarScreen from './CalendarScreen';

// Thin wrapper: same calendar UI, scoped to a specific worker's userId.
// Reached by tapping a worker on the Team tab.
export default function WorkerDetailScreen({ route }) {
  const { userId, name } = route.params;
  return <CalendarScreen userId={userId} title={`${name}'s calendar`} />;
}
