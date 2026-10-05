"use client";

import { useParams } from "next/navigation";
import QuizPlay from "@/components/quiz/quiz-play";

export default function Page() {
  const params = useParams();
  const code = typeof params.code === "string" ? params.code : "";
  return <QuizPlay code={code} />;
}
