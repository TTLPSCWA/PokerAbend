export const minute = 60_000, hour = 60 * minute, day = 24 * hour;

// Regular actions only. The driver controls server time and can take a
// screenshot or make assertions at the first arrival in each phase.
export async function playHall({ command, wait, milestone }) {
  const act = (type, fields = {}) => command({ type, ...fields });
  await milestone(1);
  await act('manual');
  await act('auto');
  await wait(35 * minute);
  await milestone(2);
  await act('buy', { station: 'dice' });
  await act('buy', { station: 'chess' });
  await act('diagnose', { station: 'dice' });
  await act('hire', { role: 'service' });
  await wait(day);
  await milestone(3);
  await act('buy', { station: 'poker' });
  await act('hire', { role: 'croupier' });
  await wait(7 * day);
  await milestone(4);
  for (let level = 1; level <= 3; level++) await act('research', { branch: 'automation' });
  await act('location', { profile: 'hafen' });
  await wait(30_000);
  await milestone(5);
  for (const [branch, first] of [['automation', 4], ['visitors', 1], ['personnel', 1]]) {
    for (let level = first; level <= 4; level++) await act('research', { branch });
  }
  for (const room of [3, 4]) await act('room', { room });
  for (const role of ['security', 'security']) await act('hire', { role });
  for (const station of ['arcade', 'blackjack', 'boardGames', 'roulette', 'vipLounge']) await act('buy', { station });
  for (const profile of ['kurort', 'messe', 'bahnhof']) await act('location', { profile });
  for (const site of ['altstadt', 'hafen', 'kurort', 'messe', 'bahnhof']) await act('comfort', { site });
  await wait(500 * day);
  await milestone(5, true);
}
