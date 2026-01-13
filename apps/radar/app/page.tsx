import Image from "next/image";

export default async function Home() {
  const res = await fetch('http://127.0.0.1:4000/api/test').then((s) => s.json());
  return (
    <div>{res.name}</div>
  );
}
