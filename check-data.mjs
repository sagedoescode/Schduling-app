import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({
  projectId: "gen-lang-client-0015354879",
  apiKey: "AIzaSyAIvlydC0on26cPJHKgYrXGACqdkZFPjw8",
  authDomain: "gen-lang-client-0015354879.firebaseapp.com",
  appId: "1:1086931048754:web:70171e773e50f4274c1f2b",
});
const db = getFirestore(app, "ai-studio-03d6300d-364f-45d0-8e0b-ee9126947626");

for (const name of ["appointments", "availability", "gabby_appointments", "gabby_availability"]) {
  const snap = await getDocs(collection(db, name));
  console.log(`${name}: ${snap.size} docs`);
  snap.docs.slice(0, 3).forEach(d => console.log("  ", d.id, JSON.stringify(d.data()).slice(0, 200)));
}
process.exit(0);
