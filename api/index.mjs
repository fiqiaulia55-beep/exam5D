// server/app.ts
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0342477582",
  appId: "1:1078225631259:web:b8b55178925f152d98a0be",
  apiKey: "AIzaSyC7UKO6W3g0JAt0rW_YTEDTzEQR8gj_1aE",
  authDomain: "gen-lang-client-0342477582.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-portalulangankel-4b3f0791-1b16-448f-bda2-b7621eb50f19",
  storageBucket: "gen-lang-client-0342477582.firebasestorage.app",
  messagingSenderId: "1078225631259",
  measurementId: "",
  oAuthClientId: "1078225631259-3gotac2k8ijto23kj4r6k25v8edg4ak7.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// data/portal-state.json
var portal_state_default = {
  settings: {
    className: "Kelas 5D",
    defaultTeacherName: "Guru Kelas 5D",
    proctorPin: "5555"
  },
  exams: [
    {
      id: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      examTitle: "SAS Akhir",
      subject: "sss",
      teacherName: "Guru Kelas 5D",
      googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdRlJRCaXaHGak5sgAvy3ZX1iDGNyYn90jQHsjuw9dFLO6i0w/viewform?usp=dialog&embedded=true",
      googleFormId: "1u6yEEd5eI2MyWZzI6mJPEErflF6GYgLZxPcEKMBYi5E",
      entryToken: "HALO",
      submitToken: "KIRIM5D",
      durationMinutes: 60,
      lockSubmitMinutes: 60,
      enableSubmitToken: true,
      enableBottomOverlayGuard: true,
      maxViolationsBeforeLock: 3,
      availabilityMode: "manual_open",
      scheduledStart: "2026-11-26T01:00:00.000Z",
      scheduledEnd: "2026-11-26T02:30:00.000Z",
      maxRawScore: 40,
      questionCount: 40,
      kkm: 75,
      webhookSecret: "4a15785e5e4612253b93eb91",
      answerKey: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      updatedAt: "2026-11-26T23:05:45.970Z"
    }
  ],
  sessions: [],
  results: [
    {
      id: "a946173b-63a9-45f0-a5f9-ff97cebd8ffd",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "abi",
      absenNumber: "1",
      rawScore: 0,
      finalScore: 0,
      itemScores: [],
      submittedAt: 1795651902949,
      source: "kiosk"
    },
    {
      id: "ac908ee9-b9e8-4e4a-96b7-233297d56c6a",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ADIVA ARIN NUR WAFA",
      absenNumber: "-",
      rawScore: 90,
      finalScore: 225,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792109329244,
      source: "google_forms"
    },
    {
      id: "7ee88d76-2ecc-42a9-af4f-3c5f033bbe67",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "Siswa 2",
      absenNumber: "-",
      rawScore: 25,
      finalScore: 62.5,
      itemScores: [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        0,
        1
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang digesek",
        "Biola",
        "Dengan meniupnya",
        "",
        "Bermain teater",
        "Angklung",
        "Trumpet",
        "Rinto Harahap",
        "Saxophone",
        "Raisa",
        "Gitar",
        "Biola",
        "Gendang",
        "",
        "Gamelan",
        "Harmoni suara",
        "Dengan memukulnya",
        "Chrisye",
        "Piano"
      ],
      submittedAt: 1795651886814,
      source: "google_forms"
    },
    {
      id: "d48155ee-6164-49dd-9e8c-fe661a7d4609",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ARTURO BRAGA",
      absenNumber: "-",
      rawScore: 75,
      finalScore: 187.5,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        0,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Ismail Marzuki",
        "Gitar",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Nada yang tinggi",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792108834356,
      source: "google_forms"
    },
    {
      id: "e15d943a-e88b-4ee1-bdcf-6f3dd4613aa6",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "MUHAMMAD AL ARIFIN",
      absenNumber: "-",
      rawScore: 65,
      finalScore: 162.5,
      itemScores: [
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        0,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang ditiup",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Wage Rudolf Supratman",
        "Gitar",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Saxophone",
        "",
        "Sasando",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792108826791,
      source: "google_forms"
    },
    {
      id: "365a125c-1f3f-4101-bd19-9e1d8ede4fdc",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ATHIRAH ANDINA",
      absenNumber: "-",
      rawScore: 85,
      finalScore: 212.5,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110663826,
      source: "google_forms"
    },
    {
      id: "83a00b2a-5e4e-4ca9-b2e7-cb08e20af27a",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "Siswa 6",
      absenNumber: "-",
      rawScore: 70,
      finalScore: 175,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        0,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Saxophone",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Saxophone",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792109707430,
      source: "google_forms"
    },
    {
      id: "9c8f4915-59e1-404d-b453-980d464d82e0",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "Siswa 7",
      absenNumber: "-",
      rawScore: 65,
      finalScore: 162.5,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        1,
        1,
        1,
        1
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Flute",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Harmonica",
        "",
        "Sasando",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110209869,
      source: "google_forms"
    },
    {
      id: "5fa1bc56-ed1e-4de0-88ac-38f6017f8724",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "REYNA RYAN NISA",
      absenNumber: "-",
      rawScore: 70,
      finalScore: 175,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Biola",
        "Gesang",
        "Gitar",
        "Tulus",
        "Trumpet",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menggeseknya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1793342765166,
      source: "google_forms"
    },
    {
      id: "22b12003-422a-4e48-b58e-c61853366e25",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "YAGIS EMRALDI PURNOMO",
      absenNumber: "-",
      rawScore: 60,
      finalScore: 150,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        0,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        0
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Wage Rudolf Supratman",
        "Harmonica",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Harmonica",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Saxophone"
      ],
      submittedAt: 1792108384840,
      source: "google_forms"
    },
    {
      id: "c9492eea-f405-4551-b160-a8448dc42c37",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ALIF SAPUTRAH",
      absenNumber: "-",
      rawScore: 25,
      finalScore: 62.5,
      itemScores: [
        0,
        0,
        1,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang ditiup",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Bermain teater",
        "Angklung",
        "Biola",
        "Wage Rudolf Supratman",
        "Gitar",
        "Iwan Fals",
        "Trumpet",
        "Piano",
        "Harmonica",
        "",
        "Kecapi",
        "Harmoni suara",
        "Dengan menekan tutsnya",
        "Ismail Marzuki",
        "Saxophone"
      ],
      submittedAt: 1795654286363,
      source: "google_forms"
    },
    {
      id: "3e1cc5d3-b4f2-45ea-96cc-77513528edba",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "SALSABILA KHALIFA FAHUNI",
      absenNumber: "-",
      rawScore: 80,
      finalScore: 200,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Rinto Harahap",
        "Gitar",
        "Tulus",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110610267,
      source: "google_forms"
    },
    {
      id: "4cc46424-8dec-4c1e-a9c8-fef00e584d15",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "AHMAD NAUFAL PRATAMA",
      absenNumber: "-",
      rawScore: 35,
      finalScore: 87.5,
      itemScores: [
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipetik",
        "Gitar",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Bermain teater",
        "Piano",
        "Trumpet",
        "Gesang",
        "Harmonica",
        "Tulus",
        "Flute",
        "Biola",
        "Gendang",
        "",
        "Gamelan",
        "Harmoni suara",
        "Dengan menggeseknya",
        "Wage Rudolf Supratman",
        "Gitar"
      ],
      submittedAt: 1795612133666,
      source: "google_forms"
    },
    {
      id: "4d1bab87-cd99-44d7-b81f-0d7294d92230",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "NAJWA AZILAH",
      absenNumber: "-",
      rawScore: 75,
      finalScore: 187.5,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Harmonica",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Harmonica",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792109842425,
      source: "google_forms"
    },
    {
      id: "95a27810-286c-42e6-90e9-4e0ab5d35d71",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "AMANDA KHALIZA PUTRI",
      absenNumber: "-",
      rawScore: 90,
      finalScore: 225,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792109606856,
      source: "google_forms"
    },
    {
      id: "c5663086-5377-4311-94f4-6cb2cb63c47e",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "MUHAMMAD ALQURAFFI HALUTI",
      absenNumber: "-",
      rawScore: 80,
      finalScore: 200,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Gitar",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan meniupnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110040842,
      source: "google_forms"
    },
    {
      id: "f02e3f80-de92-404b-a75f-4b35e9af3e8a",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "FAIRUZ GIFFARI AZHAR",
      absenNumber: "-",
      rawScore: 75,
      finalScore: 187.5,
      itemScores: [
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menekan tutsnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Saxophone",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Gendang",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110425458,
      source: "google_forms"
    },
    {
      id: "ce53f797-fa09-46be-b96e-5e50d58e958d",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ALFARIEL ARKAN RONY WIJAYA",
      absenNumber: "-",
      rawScore: 90,
      finalScore: 225,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792109907510,
      source: "google_forms"
    },
    {
      id: "479726df-815c-438e-9cdc-e2b0a55ec728",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "GHALY AL-FAEYZA",
      absenNumber: "-",
      rawScore: 75,
      finalScore: 187.5,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Ismail Marzuki",
        "Gitar",
        "Raisa",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Chrisye",
        "Piano"
      ],
      submittedAt: 1792108973860,
      source: "google_forms"
    },
    {
      id: "fb6c9e12-ba5f-4c5d-ab79-c1d974113ffe",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "BATUL ZAHRAH",
      absenNumber: "-",
      rawScore: 85,
      finalScore: 212.5,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Rinto Harahap",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792108844397,
      source: "google_forms"
    },
    {
      id: "634abfec-c90d-4cb7-921d-d0544f43f547",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "M GANESHA BANYU WICAKSONO",
      absenNumber: "-",
      rawScore: 45,
      finalScore: 112.5,
      itemScores: [
        0,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1
      ],
      answers: [
        "Ismail Marzuki",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan meniupnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Gitar",
        "Wage Rudolf Supratman",
        "Harmonica",
        "Glenn Fredly",
        "Trumpet",
        "Gitar",
        "Harmonica",
        "",
        "Angklung",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1794195733218,
      source: "google_forms"
    },
    {
      id: "e28e3acf-8637-4a0e-a1a6-df4fd12e4f61",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ZHAFRAN AL FAJAR",
      absenNumber: "-",
      rawScore: 60,
      finalScore: 150,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        0
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Wage Rudolf Supratman",
        "Gitar",
        "Raisa",
        "Trumpet",
        "Biola",
        "Harmonica",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Ismail Marzuki",
        "Saxophone"
      ],
      submittedAt: 1792111148186,
      source: "google_forms"
    },
    {
      id: "43f9642c-1e5e-4c1d-95dd-9e9c2528b69f",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "AQIFA VAZA BHINA",
      absenNumber: "-",
      rawScore: 65,
      finalScore: 162.5,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        0
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Wage Rudolf Supratman",
        "Harmonica",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Saxophone",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Saxophone"
      ],
      submittedAt: 1792108747780,
      source: "google_forms"
    },
    {
      id: "3e2b7655-7999-4145-9d4f-74c56a1ce120",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "JIBRIL AL-RIZQY SUWANDI",
      absenNumber: "-",
      rawScore: 75,
      finalScore: 187.5,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Raisa",
        "Trumpet",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792112977829,
      source: "google_forms"
    },
    {
      id: "b64fe782-92d8-4e79-a055-db66ef041c3b",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "CITRA NAGITA",
      absenNumber: "-",
      rawScore: 80,
      finalScore: 200,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Tulus",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110187077,
      source: "google_forms"
    },
    {
      id: "24ef47fc-03da-4bef-9c13-117b005b2221",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "KHUMAIRA ALMARDLIYAH",
      absenNumber: "-",
      rawScore: 85,
      finalScore: 212.5,
      itemScores: [
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipetik",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110914845,
      source: "google_forms"
    },
    {
      id: "520fc06c-dd80-4c2e-a6b8-38196228c826",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "RESA",
      absenNumber: "-",
      rawScore: 80,
      finalScore: 200,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Menggambar dengan cat",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Iwan Fals",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792109551355,
      source: "google_forms"
    },
    {
      id: "31b21a22-1cbc-42d5-bcda-0d8b87752cbe",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "NUR AMELIA",
      absenNumber: "-",
      rawScore: 85,
      finalScore: 212.5,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        0
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Saxophone"
      ],
      submittedAt: 1792111604718,
      source: "google_forms"
    },
    {
      id: "611fb640-f96b-4917-b841-fc066fa0f332",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ABBAD NAILUN NABHAN",
      absenNumber: "-",
      rawScore: 65,
      finalScore: 162.5,
      itemScores: [
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        0,
        1,
        1,
        1,
        1
      ],
      answers: [
        "W.R Soepratman",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Ismail Marzuki",
        "Gitar",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Harmonica",
        "",
        "Kecapi",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792116448601,
      source: "google_forms"
    },
    {
      id: "aa27f202-798b-405a-a341-bfdccc8a6ced",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "ALISHA SHAFIYA",
      absenNumber: "-",
      rawScore: 85,
      finalScore: 212.5,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Trumpet",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792110714500,
      source: "google_forms"
    },
    {
      id: "924ed0b9-bdfc-48a4-98d2-3a8950b4de3a",
      examId: "bd7093cb-c6c3-4b9a-ab03-e6b3757fd663",
      studentName: "Siswa 39",
      absenNumber: "-",
      rawScore: 90,
      finalScore: 225,
      itemScores: [
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ],
      answers: [
        "H Mutahar",
        "Alat musik yang dipukul atau digoyang",
        "Gendang",
        "Dengan menggoyangkan dan memukulnya",
        "",
        "Ekspresi kreatif melalui suara dan ritme",
        "Angklung",
        "Trumpet",
        "Gesang",
        "Gitar",
        "Glenn Fredly",
        "Flute",
        "Biola",
        "Biola",
        "",
        "Gamelan",
        "Polanya dalam waktu dan ketukan",
        "Dengan menekan tutsnya",
        "Wage Rudolf Supratman",
        "Piano"
      ],
      submittedAt: 1792118792316,
      source: "google_forms"
    }
  ]
};

// src/utils/formUrl.ts
function normalizeGoogleFormUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      embedUrl: "",
      originalUrl: "",
      isValid: false,
      isShortLink: false
    };
  }
  let parsed;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return {
      embedUrl: "",
      originalUrl: trimmed,
      isValid: false,
      isShortLink: false,
      warning: "Format URL tidak valid. Pastikan link dimulai dengan https://docs.google.com/forms/..."
    };
  }
  if (parsed.hostname === "forms.gle") {
    return {
      embedUrl: parsed.toString(),
      originalUrl: parsed.toString(),
      isValid: true,
      isShortLink: true,
      warning: "Link pendek forms.gle terdeteksi. Beberapa Chromebook/browser memblokir redirect forms.gle di dalam frame. Sebaiknya buka link tersebut dulu lalu salin link panjang docs.google.com/forms/d/e/.../viewform."
    };
  }
  const isGoogleForms = parsed.hostname.includes("docs.google.com") && parsed.pathname.includes("/forms");
  if (!isGoogleForms) {
    return {
      embedUrl: parsed.toString(),
      originalUrl: parsed.toString(),
      isValid: true,
      isShortLink: false,
      warning: "URL ini bukan domain standar Google Form (docs.google.com/forms). Pastikan halaman mengizinkan embed iframe."
    };
  }
  if (/\/(edit|prefill)\/?$/.test(parsed.pathname)) {
    parsed.pathname = parsed.pathname.replace(/\/(edit|prefill)\/?$/, "/viewform");
  }
  parsed.searchParams.set("embedded", "true");
  return {
    embedUrl: parsed.toString(),
    originalUrl: trimmed,
    isValid: true,
    isShortLink: false
  };
}

// src/utils/itemAnalysis.ts
function calculateFinalScore(rawScore, maxRawScore = 40) {
  const divisor = maxRawScore > 0 ? maxRawScore : 40;
  const score = rawScore / divisor * 100;
  return Math.round(score * 100) / 100;
}

// src/utils/csvParser.ts
function parseCsvMatrix(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell.trim());
        cell = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
        i++;
      } else if (ch === "\n" || ch === "\r") {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}
function parseScoreString(val) {
  if (!val) return null;
  const slashMatch = val.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*\d+(?:[.,]\d+)?$/);
  if (slashMatch) {
    return Number(slashMatch[1].replace(",", "."));
  }
  const num = Number(val.replace(",", "."));
  return Number.isFinite(num) ? num : null;
}
function normalizeAnswerText(val) {
  return val.trim().toLowerCase().replace(/\s+/g, " ");
}
function stripOptionPrefix(val) {
  return val.replace(/^[a-e]\s*[.):\-]\s*/i, "").trim();
}
function matchesAnswerText(studentAnswer, rawKey) {
  const ans = normalizeAnswerText(studentAnswer);
  if (!ans || !rawKey.trim()) return false;
  const acceptableKeys = rawKey.split(/\s*\/\s*|\s*\|\s*/).map(normalizeAnswerText).filter(Boolean);
  for (const key of acceptableKeys) {
    if (ans === key) return true;
    if (key.length === 1 && /^[a-e]$/.test(key) && (ans.startsWith(`${key}.`) || ans.startsWith(`${key})`) || ans.startsWith(`${key} -`) || ans.startsWith(`${key}:`) || ans.startsWith(`${key} `))) {
      return true;
    }
    const strippedKey = stripOptionPrefix(key);
    const strippedAns = stripOptionPrefix(ans);
    if (strippedKey && strippedAns && strippedKey === strippedAns) {
      return true;
    }
    const numKey = Number(key.replace(",", "."));
    const numAns = Number(ans.replace(",", "."));
    if (!Number.isNaN(numKey) && !Number.isNaN(numAns) && key !== "" && ans !== "" && numKey === numAns) {
      return true;
    }
  }
  return false;
}
function parseGoogleFormCsv(csvText, questionCount, answerKey = []) {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return {
      rows: [],
      detectedQuestions: 0,
      hasScoreColumn: false,
      hasPerItemScoreColumns: false
    };
  }
  const headers = matrix[0];
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const timestampIdx = lowerHeaders.findIndex(
    (h) => h.includes("timestamp") || h.includes("cap waktu") || h.includes("waktu")
  );
  const scoreIdx = lowerHeaders.findIndex(
    (h) => h === "score" || h === "skor" || h.includes("total score") || h.includes("skor total")
  );
  const nameIdx = lowerHeaders.findIndex(
    (h) => h.includes("nama") || h.includes("name")
  );
  const absenIdx = lowerHeaders.findIndex(
    (h) => h.includes("absen") || h.includes("no.") || h === "no" || h.startsWith("no ") || h.includes("nomor urut") || h.includes("no urut")
  );
  const itemScoreIndices = [];
  const questionIndices = [];
  lowerHeaders.forEach((h, idx) => {
    if (idx === timestampIdx || idx === scoreIdx || idx === nameIdx || idx === absenIdx) return;
    if (h.includes("email") || h.includes("token") || h.includes("kelas") || h.includes("nisn") || h === "nis") {
      return;
    }
    if (h.includes("[score]") || h.includes("[skor]")) {
      itemScoreIndices.push(idx);
    } else if (!h.includes("[feedback]") && !h.includes("[masukan]")) {
      questionIndices.push(idx);
    }
  });
  const hasPerItemScoreColumns = itemScoreIndices.length > 0;
  const effectiveCols = hasPerItemScoreColumns ? itemScoreIndices : questionIndices;
  const detectedQuestions = Math.min(questionCount, effectiveCols.length);
  const hasAnswerKey = answerKey.some((k) => k.trim() !== "");
  const parsedRows = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const studentName = nameIdx >= 0 && line[nameIdx] ? line[nameIdx] : `Siswa ${r}`;
    const absenNumber = absenIdx >= 0 && line[absenIdx] ? line[absenIdx] : "-";
    const submittedAt = timestampIdx >= 0 && line[timestampIdx] && !Number.isNaN(Date.parse(line[timestampIdx])) ? Date.parse(line[timestampIdx]) : Date.now();
    const answers = questionIndices.slice(0, questionCount).map((idx) => line[idx] ?? "");
    let itemScores = [];
    if (hasPerItemScoreColumns) {
      itemScores = itemScoreIndices.slice(0, questionCount).map((idx) => {
        const s = parseScoreString(line[idx] ?? "");
        return s !== null && s > 0 ? 1 : 0;
      });
    } else if (hasAnswerKey) {
      itemScores = answers.map((ans, qIdx) => {
        const key = answerKey[qIdx] ?? "";
        if (!key.trim()) return 0;
        return matchesAnswerText(ans, key) ? 1 : 0;
      });
    }
    let rawScore = scoreIdx >= 0 ? parseScoreString(line[scoreIdx] ?? "") : null;
    if (rawScore === null && itemScores.length > 0) {
      rawScore = itemScores.reduce((acc, v) => acc + v, 0);
    }
    parsedRows.push({
      studentName,
      absenNumber,
      rawScore,
      itemScores,
      answers,
      submittedAt
    });
  }
  return {
    rows: parsedRows,
    detectedQuestions,
    hasScoreColumn: scoreIdx >= 0,
    hasPerItemScoreColumns
  };
}

// server/app.ts
dotenv.config();
var CURRENT_DIR = (() => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {
  }
  return process.cwd();
})();
var IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
var DATA_DIR = IS_VERCEL ? path.join("/tmp", "portal-cbt-5d") : path.resolve(process.cwd(), "data");
var STATE_FILE = path.join(DATA_DIR, "portal-state.json");
var KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(
  /\/+$/,
  ""
);
var KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
var KV_STATE_KEY = process.env.PORTAL_KV_KEY || "portal_cbt_5d_state_v1";
function loadFirebaseConfig() {
  const candidates = [
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    path.resolve(CURRENT_DIR, "../firebase-applet-config.json")
  ];
  for (const cfgPath of candidates) {
    try {
      if (fs.existsSync(cfgPath)) {
        return JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      }
    } catch {
    }
  }
  if (firebase_applet_config_default && typeof firebase_applet_config_default === "object") {
    return firebase_applet_config_default;
  }
  return {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    projectId: process.env.FIREBASE_PROJECT_ID
  };
}
var SIGNING_SECRET = (() => {
  const explicit = process.env.PORTAL_SIGNING_SECRET || process.env.KV_REST_API_TOKEN || "";
  if (explicit) return explicit;
  const cfg = loadFirebaseConfig();
  return crypto.createHash("sha256").update(`portal-cbt-5d:${cfg.projectId || "local"}:${cfg.apiKey || "dev"}`).digest("hex");
})();
var DEFAULT_SETTINGS = {
  className: "Kelas 5D",
  defaultTeacherName: "Guru Kelas 5D",
  proctorPin: "5555"
};
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
  }
}
function normalizeExamRecord(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    examTitle: raw.examTitle || "",
    subject: raw.subject || "",
    teacherName: raw.teacherName || DEFAULT_SETTINGS.defaultTeacherName,
    googleFormUrl: raw.googleFormUrl || "",
    googleFormId: raw.googleFormId || "",
    googleSheetUrl: raw.googleSheetUrl || "",
    entryToken: raw.entryToken || "",
    submitToken: raw.submitToken || "KIRIM5D",
    durationMinutes: Number(raw.durationMinutes) || 60,
    lockSubmitMinutes: Number(raw.lockSubmitMinutes ?? 60),
    enableSubmitToken: Boolean(raw.enableSubmitToken ?? true),
    enableBottomOverlayGuard: Boolean(raw.enableBottomOverlayGuard ?? false),
    maxViolationsBeforeLock: Number(raw.maxViolationsBeforeLock) || 3,
    availabilityMode: raw.availabilityMode || "scheduled",
    scheduledStart: raw.scheduledStart || "",
    scheduledEnd: raw.scheduledEnd || "",
    maxRawScore: Number(raw.maxRawScore) || 40,
    questionCount: Number(raw.questionCount) || 40,
    kkm: Number(raw.kkm) || 75,
    webhookSecret: raw.webhookSecret || crypto.randomBytes(12).toString("hex"),
    answerKey: Array.isArray(raw.answerKey) ? raw.answerKey : [],
    updatedAt: raw.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
function normalizeParsedState(parsed) {
  return {
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings || {} },
    exams: Array.isArray(parsed.exams) ? parsed.exams.map(normalizeExamRecord) : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    results: Array.isArray(parsed.results) ? parsed.results : []
  };
}
function loadStateFromDisk() {
  ensureDataDir();
  const candidates = [
    STATE_FILE,
    path.resolve(process.cwd(), "data", "portal-state.json"),
    path.resolve(CURRENT_DIR, "../data/portal-state.json")
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, "utf-8");
        const parsed = JSON.parse(raw);
        return normalizeParsedState(parsed);
      }
    } catch {
    }
  }
  if (portal_state_default && typeof portal_state_default === "object") {
    return normalizeParsedState(portal_state_default);
  }
  return { settings: { ...DEFAULT_SETTINGS }, exams: [], sessions: [], results: [] };
}
var state = loadStateFromDisk();
var lastKvSyncMs = 0;
async function syncStateFromKv(force = false) {
  if (!KV_URL || !KV_TOKEN) return;
  const now = Date.now();
  if (!force && now - lastKvSyncMs < 1e3) return;
  try {
    const res = await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["GET", KV_STATE_KEY])
    });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.result === "string" && data.result) {
      const parsedValue = JSON.parse(data.result);
      const parsedObj = typeof parsedValue === "string" ? JSON.parse(parsedValue) : parsedValue;
      if (parsedObj && typeof parsedObj === "object") {
        state = normalizeParsedState(parsedObj);
      }
    }
    lastKvSyncMs = Date.now();
  } catch {
  }
}
async function saveState() {
  ensureDataDir();
  const serialized = JSON.stringify(state, null, 2);
  try {
    fs.writeFileSync(STATE_FILE, serialized, "utf-8");
  } catch {
  }
  if (KV_URL && KV_TOKEN) {
    try {
      await fetch(KV_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(["SET", KV_STATE_KEY, serialized])
      });
      lastKvSyncMs = Date.now();
    } catch {
    }
  }
}
function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function signSessionEnvelope(envelope) {
  const payload = Buffer.from(JSON.stringify(envelope), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("base64url");
  if (!safeEqual(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    );
    if (!parsed?.session?.id || !parsed?.session?.examId) return null;
    return parsed;
  } catch {
    return null;
  }
}
function computeExamStatus(exam, now) {
  if (!exam.googleFormUrl.trim()) {
    return "no_form";
  }
  if (exam.availabilityMode === "closed") {
    return "closed";
  }
  if (exam.availabilityMode === "manual_open") {
    return "open";
  }
  const startMs = exam.scheduledStart ? Date.parse(exam.scheduledStart) : NaN;
  const endMs = exam.scheduledEnd ? Date.parse(exam.scheduledEnd) : NaN;
  if (!Number.isNaN(startMs) && now < startMs) {
    return "upcoming";
  }
  if (!Number.isNaN(endMs) && now > endMs) {
    return "ended";
  }
  return "open";
}
function toPublicExam(exam, now) {
  return {
    id: exam.id,
    examTitle: exam.examTitle,
    subject: exam.subject,
    className: state.settings.className,
    teacherName: exam.teacherName || state.settings.defaultTeacherName,
    durationMinutes: exam.durationMinutes,
    lockSubmitMinutes: exam.lockSubmitMinutes,
    enableSubmitToken: exam.enableSubmitToken,
    enableBottomOverlayGuard: exam.enableBottomOverlayGuard,
    maxViolationsBeforeLock: exam.maxViolationsBeforeLock,
    availabilityMode: exam.availabilityMode,
    scheduledStart: exam.scheduledStart,
    scheduledEnd: exam.scheduledEnd,
    hasFormUrl: Boolean(exam.googleFormUrl.trim()),
    computedStatus: computeExamStatus(exam, now),
    updatedAt: exam.updatedAt
  };
}
function buildActiveSessionResponse(session, exam, now, fallbackEnvelope) {
  const submitUnlocked = now >= session.unlockAt;
  const googleFormUrl = exam?.googleFormUrl || fallbackEnvelope?.googleFormUrl || "";
  const enableSubmitToken = exam?.enableSubmitToken ?? fallbackEnvelope?.enableSubmitToken ?? false;
  const rawSubmitToken = exam?.submitToken || fallbackEnvelope?.submitToken || "KIRIM5D";
  const maxViolations = exam?.maxViolationsBeforeLock ?? fallbackEnvelope?.maxViolationsBeforeLock ?? 3;
  const examPublic = exam ? toPublicExam(exam, now) : fallbackEnvelope?.examPublic || {
    id: session.examId,
    examTitle: session.examTitle,
    subject: session.subject,
    className: state.settings.className,
    teacherName: state.settings.defaultTeacherName,
    durationMinutes: 60,
    lockSubmitMinutes: 60,
    enableSubmitToken,
    enableBottomOverlayGuard: false,
    maxViolationsBeforeLock: maxViolations,
    availabilityMode: "manual_open",
    scheduledStart: "",
    scheduledEnd: "",
    hasFormUrl: Boolean(googleFormUrl),
    computedStatus: "open",
    updatedAt: new Date(session.startedAt).toISOString()
  };
  const sessionToken = signSessionEnvelope({
    session,
    googleFormUrl,
    submitToken: rawSubmitToken,
    enableSubmitToken,
    maxViolationsBeforeLock: maxViolations,
    examPublic
  });
  return {
    session,
    googleFormUrl,
    submitUnlocked,
    submitToken: submitUnlocked && enableSubmitToken ? rawSubmitToken : null,
    serverTime: now,
    exam: examPublic,
    sessionToken
  };
}
function upsertStudentResult(exam, payload) {
  const cleanName = payload.studentName.trim();
  const cleanAbsen = payload.absenNumber.trim();
  const maxRaw = exam.maxRawScore || 40;
  const rawScore = Math.max(0, Number(payload.rawScore) || 0);
  const finalScore = calculateFinalScore(rawScore, maxRaw);
  let existingIdx = state.results.findIndex(
    (r) => r.examId === exam.id && r.absenNumber.toLowerCase() === cleanAbsen.toLowerCase() && r.studentName.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingIdx < 0 && payload.source !== "kiosk") {
    const normAbsen = cleanAbsen.replace(/^0+/, "").toLowerCase();
    existingIdx = state.results.findIndex((r) => {
      if (r.examId !== exam.id || r.source !== "kiosk") return false;
      const rName = r.studentName.trim().toLowerCase();
      const qName = cleanName.toLowerCase();
      if (rName === qName) return true;
      if (qName.length >= 3 && rName.length >= 3 && (rName.includes(qName) || qName.includes(rName))) {
        return true;
      }
      const rAbsen = r.absenNumber.trim().replace(/^0+/, "").toLowerCase();
      return normAbsen !== "-" && normAbsen !== "" && rAbsen === normAbsen;
    });
  }
  if (existingIdx >= 0 && payload.source === "kiosk" && state.results[existingIdx].source !== "kiosk") {
    return state.results[existingIdx];
  }
  const record = {
    id: existingIdx >= 0 ? state.results[existingIdx].id : crypto.randomUUID(),
    examId: exam.id,
    studentName: cleanName,
    absenNumber: cleanAbsen,
    rawScore,
    finalScore,
    itemScores: payload.itemScores.map((v) => Number(v) > 0 ? 1 : 0),
    answers: payload.answers,
    submittedAt: payload.submittedAt || Date.now(),
    source: payload.source
  };
  if (existingIdx >= 0) {
    state.results[existingIdx] = record;
  } else {
    state.results.push(record);
  }
  return record;
}
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "4mb" }));
  app2.use("/api", async (_req, _res, next) => {
    await syncStateFromKv(false);
    next();
  });
  app2.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      vercel: IS_VERCEL,
      hasKv: Boolean(KV_URL && KV_TOKEN),
      examCount: state.exams.length
    });
  });
  app2.get("/api/exam/public", (_req, res) => {
    const now = Date.now();
    const sortedExams = state.exams.slice().sort((a, b) => {
      const aTime = a.scheduledStart ? Date.parse(a.scheduledStart) : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduledStart ? Date.parse(b.scheduledStart) : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }).map((ex) => toPublicExam(ex, now));
    res.json({
      settings: {
        className: state.settings.className,
        defaultTeacherName: state.settings.defaultTeacherName
      },
      exams: sortedExams,
      serverTime: now
    });
  });
  app2.get("/api/sessions/summary", (_req, res) => {
    const now = Date.now();
    const list = state.sessions.slice().sort((a, b) => b.startedAt - a.startedAt).map((s) => ({
      id: s.id,
      examId: s.examId,
      examTitle: s.examTitle,
      subject: s.subject,
      studentName: s.studentName,
      absenNumber: s.absenNumber,
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      unlockAt: s.unlockAt,
      status: s.status,
      violationCount: s.violations.length,
      lastViolation: s.violations.length > 0 ? s.violations[s.violations.length - 1] : null,
      finishedAt: s.finishedAt,
      remainingSeconds: Math.max(0, Math.floor((s.endsAt - now) / 1e3))
    }));
    res.json({ sessions: list, serverTime: now });
  });
  app2.post("/api/exam/verify-proctor", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas tidak sesuai." });
      return;
    }
    res.json({
      settings: state.settings,
      exams: state.exams,
      sessions: state.sessions.slice().sort((a, b) => b.startedAt - a.startedAt),
      results: state.results.slice().sort((a, b) => b.submittedAt - a.submittedAt),
      serverTime: Date.now()
    });
  });
  async function verifyTeacherIdToken(idToken) {
    const cfg = loadFirebaseConfig();
    if (!cfg.apiKey) {
      return { ok: false, status: 500, error: "API key Firebase tidak ditemukan." };
    }
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
    const verifyData = await verifyRes.json().catch(() => ({}));
    const userRecord = verifyData.users?.[0];
    const email = String(userRecord?.email || "").trim().toLowerCase();
    const uid = String(userRecord?.localId || "").trim();
    if (!verifyRes.ok || !userRecord || !userRecord.emailVerified || !email) {
      return {
        ok: false,
        status: 401,
        error: "Sesi Google tidak valid atau email belum terverifikasi."
      };
    }
    return { ok: true, email, uid };
  }
  async function isAuthorizedTeacherRequest(req) {
    const currentPin = String(req.body?.currentPin ?? req.body?.pin ?? "").trim();
    if (currentPin && safeEqual(currentPin, state.settings.proctorPin)) {
      return true;
    }
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const idToken = String(req.body?.idToken ?? bearerToken).trim();
    if (!idToken) return false;
    try {
      const check = await verifyTeacherIdToken(idToken);
      return check.ok === true;
    } catch {
      return false;
    }
  }
  app2.post("/api/exam/verify-proctor-google", async (req, res) => {
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const idToken = String(req.body?.idToken ?? bearerToken).trim();
    if (!idToken) {
      res.status(400).json({ error: "Token login Google tidak tersedia." });
      return;
    }
    try {
      const check = await verifyTeacherIdToken(idToken);
      if (check.ok === false) {
        res.status(check.status).json({ error: check.error });
        return;
      }
      res.json({
        proctorPin: state.settings.proctorPin,
        email: check.email,
        uid: check.uid,
        settings: state.settings,
        exams: state.exams,
        sessions: state.sessions.slice().sort((a, b) => b.startedAt - a.startedAt),
        results: state.results.slice().sort((a, b) => b.submittedAt - a.submittedAt),
        serverTime: Date.now()
      });
    } catch {
      res.status(500).json({ error: "Gagal memverifikasi akun Google Guru." });
    }
  });
  async function resolveFormsGleUrl(rawUrl) {
    let parsed;
    try {
      parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    } catch {
      throw new Error("Format URL tidak valid.");
    }
    if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "forms.gle") {
      throw new Error("Hanya tautan https://forms.gle/... yang dapat diuraikan.");
    }
    const resp = await fetch(parsed.toString(), { method: "GET", redirect: "follow" });
    const finalUrl = resp.url || "";
    if (!finalUrl.startsWith("https://docs.google.com/forms/")) {
      throw new Error("Tautan forms.gle tidak mengarah ke Google Form yang valid.");
    }
    return finalUrl;
  }
  app2.post("/api/forms/resolve-short-url", async (req, res) => {
    const rawUrl = String(req.body?.url ?? "").trim();
    try {
      const resolvedUrl = await resolveFormsGleUrl(rawUrl);
      res.json({ resolvedUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuka tautan pendek forms.gle.";
      const status = msg.includes("Format URL") || msg.includes("Hanya tautan") || msg.includes("tidak mengarah") ? 400 : 502;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/portal/settings", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas tidak valid." });
      return;
    }
    const incoming = req.body?.settings;
    if (!incoming) {
      res.status(400).json({ error: "Data pengaturan tidak lengkap." });
      return;
    }
    const nextPin = String(incoming.proctorPin ?? state.settings.proctorPin).trim();
    if (nextPin.length < 4) {
      res.status(400).json({ error: "PIN Pengawas minimal 4 karakter." });
      return;
    }
    state.settings = {
      className: String(incoming.className ?? state.settings.className).trim() || "Kelas 5D",
      defaultTeacherName: String(incoming.defaultTeacherName ?? state.settings.defaultTeacherName).trim() || "Guru Kelas 5D",
      proctorPin: nextPin
    };
    await saveState();
    res.json({ settings: state.settings });
  });
  app2.post("/api/portal/export-json", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    res.json({
      version: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      settings: state.settings,
      exams: state.exams,
      sessions: state.sessions,
      results: state.results
    });
  });
  app2.post("/api/portal/import-json", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    const payload = req.body?.data;
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.exams) && !payload.settings) {
      res.status(400).json({ error: "Format file JSON database tidak valid." });
      return;
    }
    const nextState = normalizeParsedState(payload);
    state = nextState;
    await saveState();
    const now = Date.now();
    res.json({
      settings: state.settings,
      exams: state.exams,
      sessions: state.sessions.slice().sort((a, b) => b.startedAt - a.startedAt),
      results: state.results.slice().sort((a, b) => b.submittedAt - a.submittedAt),
      publicPayload: {
        settings: {
          className: state.settings.className,
          defaultTeacherName: state.settings.defaultTeacherName
        },
        exams: state.exams.map((ex) => toPublicExam(ex, now)),
        serverTime: now
      }
    });
  });
  app2.post("/api/exams/hydrate", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google Guru tidak valid." });
      return;
    }
    const incomingSettings = req.body?.settings;
    if (incomingSettings && typeof incomingSettings.className === "string") {
      state.settings = {
        className: incomingSettings.className.trim() || state.settings.className,
        defaultTeacherName: String(incomingSettings.defaultTeacherName ?? state.settings.defaultTeacherName).trim() || state.settings.defaultTeacherName,
        proctorPin: String(incomingSettings.proctorPin ?? state.settings.proctorPin).trim().length >= 4 ? String(incomingSettings.proctorPin).trim() : state.settings.proctorPin
      };
    }
    const incomingExams = Array.isArray(req.body?.exams) ? req.body.exams : [];
    for (const rawEx of incomingExams) {
      if (!rawEx.id || !rawEx.examTitle) continue;
      const normalized = normalizeExamRecord(rawEx);
      const idx = state.exams.findIndex((e) => e.id === normalized.id);
      if (idx >= 0) {
        const localTime = Date.parse(state.exams[idx].updatedAt || "") || 0;
        const remoteTime = Date.parse(normalized.updatedAt || "") || 0;
        if (remoteTime >= localTime) {
          state.exams[idx] = normalized;
        }
      } else {
        state.exams.push(normalized);
      }
    }
    const incomingResults = Array.isArray(req.body?.results) ? req.body.results : [];
    for (const r of incomingResults) {
      if (!r?.id || !r?.examId) continue;
      const idx = state.results.findIndex(
        (existing) => existing.id === r.id || existing.examId === r.examId && existing.absenNumber.toLowerCase() === r.absenNumber.toLowerCase() && existing.studentName.toLowerCase() === r.studentName.toLowerCase()
      );
      if (idx < 0) {
        state.results.push(r);
      } else if (state.results[idx].source === "kiosk" && r.source !== "kiosk") {
        state.results[idx] = r;
      }
    }
    await saveState();
    const now = Date.now();
    res.json({
      settings: state.settings,
      exams: state.exams,
      results: state.results,
      publicPayload: {
        settings: {
          className: state.settings.className,
          defaultTeacherName: state.settings.defaultTeacherName
        },
        exams: state.exams.map((ex) => toPublicExam(ex, now)),
        serverTime: now
      }
    });
  });
  app2.post("/api/exams/save", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    const incoming = req.body?.exam;
    if (!incoming) {
      res.status(400).json({ error: "Data ulangan tidak lengkap." });
      return;
    }
    const examTitle = String(incoming.examTitle ?? "").trim();
    const subject = String(incoming.subject ?? "").trim();
    if (!examTitle) {
      res.status(400).json({ error: "Judul ulangan tidak boleh kosong." });
      return;
    }
    if (!subject) {
      res.status(400).json({ error: "Mata pelajaran tidak boleh kosong." });
      return;
    }
    let rawUrl = String(incoming.googleFormUrl ?? "").trim();
    let normalized = rawUrl ? normalizeGoogleFormUrl(rawUrl) : null;
    if (normalized?.isShortLink) {
      try {
        rawUrl = await resolveFormsGleUrl(normalized.originalUrl);
        normalized = normalizeGoogleFormUrl(rawUrl);
      } catch {
      }
    }
    if (normalized && !normalized.isValid) {
      res.status(400).json({ error: normalized.warning || "Link Google Form tidak valid." });
      return;
    }
    const entryToken = String(incoming.entryToken ?? "").trim().toUpperCase();
    if (!entryToken) {
      res.status(400).json({ error: "Token masuk ujian tidak boleh kosong." });
      return;
    }
    const durationMinutes = Math.min(240, Math.max(1, Number(incoming.durationMinutes) || 60));
    const lockSubmitMinutes = Math.min(
      durationMinutes,
      Math.max(0, Number(incoming.lockSubmitMinutes ?? durationMinutes))
    );
    const availabilityMode = incoming.availabilityMode === "manual_open" || incoming.availabilityMode === "closed" || incoming.availabilityMode === "scheduled" ? incoming.availabilityMode : "scheduled";
    const scheduledStart = String(incoming.scheduledStart ?? "").trim();
    const scheduledEnd = String(incoming.scheduledEnd ?? "").trim();
    if (availabilityMode === "scheduled" && (!scheduledStart || !scheduledEnd)) {
      res.status(400).json({
        error: "Untuk mode terjadwal, isi waktu mulai dan waktu selesai ulangan."
      });
      return;
    }
    if (scheduledStart && scheduledEnd && Date.parse(scheduledEnd) <= Date.parse(scheduledStart)) {
      res.status(400).json({
        error: "Waktu selesai jadwal harus lebih lambat daripada waktu mulai."
      });
      return;
    }
    const existingIdx = incoming.id ? state.exams.findIndex((ex) => ex.id === incoming.id) : -1;
    const prev = existingIdx >= 0 ? state.exams[existingIdx] : null;
    const maxRawScore = Math.max(1, Number(incoming.maxRawScore) || prev?.maxRawScore || 40);
    const questionCount = Math.min(
      100,
      Math.max(1, Number(incoming.questionCount) || prev?.questionCount || 40)
    );
    const kkm = Math.min(100, Math.max(0, Number(incoming.kkm ?? prev?.kkm ?? 75)));
    const savedExam = {
      id: prev ? prev.id : incoming.id || crypto.randomUUID(),
      examTitle,
      subject,
      teacherName: String(incoming.teacherName ?? "").trim() || state.settings.defaultTeacherName,
      googleFormUrl: normalized ? normalized.embedUrl : "",
      googleFormId: String(incoming.googleFormId ?? prev?.googleFormId ?? "").trim(),
      googleSheetUrl: String(incoming.googleSheetUrl ?? prev?.googleSheetUrl ?? "").trim(),
      entryToken,
      submitToken: String(incoming.submitToken ?? "").trim().toUpperCase() || "KIRIM5D",
      durationMinutes,
      lockSubmitMinutes,
      enableSubmitToken: Boolean(incoming.enableSubmitToken ?? true),
      enableBottomOverlayGuard: Boolean(incoming.enableBottomOverlayGuard ?? false),
      maxViolationsBeforeLock: Math.min(
        10,
        Math.max(1, Number(incoming.maxViolationsBeforeLock) || 3)
      ),
      availabilityMode,
      scheduledStart,
      scheduledEnd,
      maxRawScore,
      questionCount,
      kkm,
      webhookSecret: prev?.webhookSecret || crypto.randomBytes(12).toString("hex"),
      answerKey: Array.isArray(incoming.answerKey) ? incoming.answerKey : prev?.answerKey || [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (existingIdx >= 0) {
      state.exams[existingIdx] = savedExam;
      state.results = state.results.map(
        (r) => r.examId === savedExam.id ? { ...r, finalScore: calculateFinalScore(r.rawScore, savedExam.maxRawScore) } : r
      );
    } else {
      state.exams.push(savedExam);
    }
    await saveState();
    res.json({
      exam: savedExam,
      exams: state.exams,
      results: state.results,
      warning: normalized?.warning
    });
  });
  app2.post("/api/exams/delete", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas tidak valid." });
      return;
    }
    const examId = String(req.body?.examId ?? "").trim();
    state.exams = state.exams.filter((ex) => ex.id !== examId);
    state.results = state.results.filter((r) => r.examId !== examId);
    await saveState();
    res.json({ exams: state.exams, results: state.results });
  });
  app2.post("/api/exams/:examId/results/import", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    let exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam && req.body?.examSnapshot && typeof req.body.examSnapshot === "object") {
      const snap = normalizeExamRecord({
        ...req.body.examSnapshot,
        id: req.params.examId
      });
      if (snap.examTitle) {
        state.exams.push(snap);
        exam = snap;
      }
    }
    if (!exam) {
      res.status(404).json({ error: "Ulangan tidak ditemukan." });
      return;
    }
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const hasMetaUpdates = Array.isArray(req.body?.answerKey) || typeof req.body?.googleFormId === "string";
    if (rows.length === 0 && !hasMetaUpdates) {
      res.status(400).json({ error: "Tidak ada data siswa yang diimpor." });
      return;
    }
    if (Array.isArray(req.body?.answerKey)) {
      exam.answerKey = req.body.answerKey.map((k) => String(k ?? "").trim());
    }
    if (typeof req.body?.googleFormId === "string" && req.body.googleFormId.trim()) {
      exam.googleFormId = req.body.googleFormId.trim();
    }
    const importSource = req.body?.source === "google_forms" ? "google_forms" : "csv";
    for (const row of rows) {
      const itemScores = Array.isArray(row.itemScores) ? row.itemScores.map((v) => Number(v) > 0 ? 1 : 0) : [];
      const rawScore = row.rawScore !== null && row.rawScore !== void 0 ? Number(row.rawScore) : itemScores.reduce((acc, v) => acc + v, 0);
      upsertStudentResult(exam, {
        studentName: String(row.studentName ?? "Siswa"),
        absenNumber: String(row.absenNumber ?? "-"),
        rawScore,
        itemScores,
        answers: Array.isArray(row.answers) ? row.answers.map(String) : void 0,
        submittedAt: Number(row.submittedAt) || Date.now(),
        source: importSource
      });
    }
    await saveState();
    res.json({
      results: state.results.filter((r) => r.examId === exam.id),
      exams: state.exams
    });
  });
  app2.post("/api/exams/:examId/results/upsert", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas tidak valid." });
      return;
    }
    const exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam) {
      res.status(404).json({ error: "Ulangan tidak ditemukan." });
      return;
    }
    const studentName = String(req.body?.studentName ?? "").trim();
    const absenNumber = String(req.body?.absenNumber ?? "").trim();
    if (!studentName || !absenNumber) {
      res.status(400).json({ error: "Nama siswa dan nomor absen wajib diisi." });
      return;
    }
    const itemScores = Array.isArray(req.body?.itemScores) ? req.body.itemScores.map((v) => Number(v) > 0 ? 1 : 0) : [];
    const rawScore = req.body?.rawScore !== void 0 && req.body?.rawScore !== null ? Number(req.body.rawScore) : itemScores.reduce((acc, v) => acc + v, 0);
    upsertStudentResult(exam, {
      studentName,
      absenNumber,
      rawScore,
      itemScores,
      source: "manual"
    });
    await saveState();
    res.json({ results: state.results.filter((r) => r.examId === exam.id) });
  });
  app2.post("/api/exams/:examId/results/delete", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas tidak valid." });
      return;
    }
    const resultId = req.body?.resultId ? String(req.body.resultId) : null;
    if (resultId) {
      state.results = state.results.filter((r) => r.id !== resultId);
    } else {
      state.results = state.results.filter((r) => r.examId !== req.params.examId);
    }
    await saveState();
    res.json({ results: state.results.filter((r) => r.examId === req.params.examId) });
  });
  function gradeAnswersWithKey(answers, answerKey, questionCount) {
    const limit = Math.min(questionCount, Math.max(answers.length, answerKey.length));
    const itemScores = [];
    for (let i = 0; i < limit; i++) {
      const key = (answerKey[i] ?? "").trim();
      const ans = answers[i] ?? "";
      itemScores.push(key && matchesAnswerText(ans, key) ? 1 : 0);
    }
    const rawScore = itemScores.reduce((acc, v) => acc + v, 0);
    return { itemScores, rawScore };
  }
  app2.post("/api/exams/:examId/answer-key", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    const exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam) {
      res.status(404).json({ error: "Ulangan tidak ditemukan." });
      return;
    }
    const keyList = Array.isArray(req.body?.answerKey) ? req.body.answerKey.map((k) => String(k ?? "").trim()).slice(0, 100) : [];
    exam.answerKey = keyList;
    exam.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (keyList.some((k) => k !== "")) {
      state.results = state.results.map((r) => {
        if (r.examId !== exam.id || !r.answers || r.answers.length === 0) return r;
        const graded = gradeAnswersWithKey(r.answers, keyList, exam.questionCount || 40);
        return {
          ...r,
          itemScores: graded.itemScores,
          rawScore: graded.rawScore,
          finalScore: calculateFinalScore(graded.rawScore, exam.maxRawScore || 40)
        };
      });
    }
    await saveState();
    res.json({
      exam,
      exams: state.exams,
      results: state.results.filter((r) => r.examId === exam.id)
    });
  });
  app2.post("/api/exams/:examId/results/sync-sheet", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    const exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam) {
      res.status(404).json({ error: "Ulangan tidak ditemukan." });
      return;
    }
    const rawSheetUrl = String(req.body?.googleSheetUrl ?? exam.googleSheetUrl ?? "").trim();
    if (!rawSheetUrl) {
      res.status(400).json({ error: "Masukkan link Google Sheet respon Google Form terlebih dahulu." });
      return;
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(/^https?:\/\//i.test(rawSheetUrl) ? rawSheetUrl : `https://${rawSheetUrl}`);
    } catch {
      res.status(400).json({ error: "Format link Google Sheet tidak valid." });
      return;
    }
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname.toLowerCase() !== "docs.google.com" || !parsedUrl.pathname.startsWith("/spreadsheets/")) {
      res.status(400).json({
        error: "Hanya link resmi https://docs.google.com/spreadsheets/... yang diizinkan."
      });
      return;
    }
    const gid = parsedUrl.searchParams.get("gid") || "";
    const pubMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
    const directMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9_-]+)/);
    let csvExportUrl = "";
    if (pubMatch) {
      csvExportUrl = `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ""}`;
    } else if (directMatch) {
      csvExportUrl = `https://docs.google.com/spreadsheets/d/${directMatch[1]}/export?format=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ""}`;
    } else {
      res.status(400).json({ error: "ID Google Spreadsheet tidak terbaca dari link tersebut." });
      return;
    }
    let csvText = "";
    try {
      const sheetRes = await fetch(csvExportUrl, { method: "GET", redirect: "follow" });
      csvText = await sheetRes.text();
      const lower = csvText.trim().slice(0, 300).toLowerCase();
      if (!sheetRes.ok || lower.startsWith("<!doctype html") || lower.startsWith("<html") || sheetRes.url.includes("accounts.google.com")) {
        res.status(400).json({
          error: 'Google Sheet respon belum bisa diakses publik. Di Google Sheet respon Form, klik Bagikan > Ubah akses ke "Siapa saja yang memiliki link dapat melihat" (atau File > Bagikan > Publikasikan ke web), lalu coba tarik ulang.'
        });
        return;
      }
    } catch {
      res.status(502).json({ error: "Gagal menghubungi Google Spreadsheet." });
      return;
    }
    const providedKey = Array.isArray(req.body?.answerKey) ? req.body.answerKey.map((k) => String(k ?? "").trim()).filter(Boolean) : [];
    const effectiveKey = providedKey.length > 0 ? providedKey : exam.answerKey || [];
    const parsed = parseGoogleFormCsv(csvText, exam.questionCount || 40, effectiveKey);
    if (parsed.rows.length === 0) {
      res.status(400).json({
        error: "Spreadsheet berhasil dibuka, namun belum ada baris respon siswa yang terbaca."
      });
      return;
    }
    exam.googleSheetUrl = rawSheetUrl;
    if (providedKey.length > 0) {
      exam.answerKey = providedKey;
    }
    exam.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const row of parsed.rows) {
      const itemScores = Array.isArray(row.itemScores) ? row.itemScores.map((v) => Number(v) > 0 ? 1 : 0) : [];
      const rawScore = row.rawScore !== null && row.rawScore !== void 0 ? Number(row.rawScore) : itemScores.reduce((acc, v) => acc + v, 0);
      upsertStudentResult(exam, {
        studentName: row.studentName,
        absenNumber: row.absenNumber,
        rawScore,
        itemScores,
        answers: row.answers,
        submittedAt: row.submittedAt,
        source: "google_forms"
      });
    }
    await saveState();
    res.json({
      exam,
      exams: state.exams,
      results: state.results.filter((r) => r.examId === exam.id),
      syncedCount: parsed.rows.length,
      detectedQuestions: parsed.detectedQuestions,
      hasScoreColumn: parsed.hasScoreColumn
    });
  });
  app2.post("/api/webhook/form-response/:examId", async (req, res) => {
    const exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam) {
      res.status(404).json({ error: "Ulangan tidak ditemukan." });
      return;
    }
    const providedSecret = String(
      req.headers["x-webhook-secret"] ?? req.body?.secret ?? ""
    ).trim();
    if (!providedSecret || !safeEqual(providedSecret, exam.webhookSecret)) {
      res.status(401).json({ error: "Secret webhook tidak valid." });
      return;
    }
    if (Array.isArray(req.body?.answerKey) && req.body.answerKey.length > 0) {
      exam.answerKey = req.body.answerKey.map((k) => String(k ?? "").trim()).slice(0, 100);
      exam.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    const batchRows = Array.isArray(req.body?.batch) ? req.body.batch : null;
    const hasExamKey = (exam.answerKey || []).some((k) => k.trim() !== "");
    if (batchRows) {
      let synced = 0;
      for (const row of batchRows) {
        const sName = String(row?.studentName ?? "").trim();
        if (!sName) continue;
        const sAbsen = String(row?.absenNumber ?? "").trim() || "-";
        let itemScores2 = Array.isArray(row?.itemScores) ? row.itemScores.map((v) => Number(v) > 0 ? 1 : 0) : [];
        const answers2 = Array.isArray(row?.answers) ? row.answers.map(String) : void 0;
        let rawScore2 = row?.rawScore !== void 0 && row?.rawScore !== null ? Number(row.rawScore) : itemScores2.reduce((acc, v) => acc + v, 0);
        if (rawScore2 === 0 && !itemScores2.some((v) => v > 0) && answers2 && answers2.length > 0 && hasExamKey) {
          const graded = gradeAnswersWithKey(answers2, exam.answerKey, exam.questionCount || 40);
          itemScores2 = graded.itemScores;
          rawScore2 = graded.rawScore;
        }
        upsertStudentResult(exam, {
          studentName: sName,
          absenNumber: sAbsen,
          rawScore: rawScore2,
          itemScores: itemScores2,
          answers: answers2,
          submittedAt: Number(row?.submittedAt) || Date.now(),
          source: "google_forms"
        });
        synced++;
      }
      await saveState();
      res.json({ ok: true, synced });
      return;
    }
    const studentName = String(req.body?.studentName ?? "").trim();
    const absenNumber = String(req.body?.absenNumber ?? "").trim();
    if (!studentName) {
      if (Array.isArray(req.body?.answerKey)) {
        await saveState();
        res.json({ ok: true, answerKey: exam.answerKey });
        return;
      }
      res.status(400).json({ error: "studentName wajib dikirim." });
      return;
    }
    let itemScores = Array.isArray(req.body?.itemScores) ? req.body.itemScores.map((v) => Number(v) > 0 ? 1 : 0) : [];
    const answers = Array.isArray(req.body?.answers) ? req.body.answers.map(String) : void 0;
    let rawScore = req.body?.rawScore !== void 0 && req.body?.rawScore !== null ? Number(req.body.rawScore) : itemScores.reduce((acc, v) => acc + v, 0);
    if (rawScore === 0 && !itemScores.some((v) => v > 0) && answers && answers.length > 0 && hasExamKey) {
      const graded = gradeAnswersWithKey(answers, exam.answerKey, exam.questionCount || 40);
      itemScores = graded.itemScores;
      rawScore = graded.rawScore;
    }
    const saved = upsertStudentResult(exam, {
      studentName,
      absenNumber: absenNumber || "-",
      rawScore,
      itemScores,
      answers,
      submittedAt: Date.now(),
      source: "webhook"
    });
    await saveState();
    res.json({ ok: true, id: saved.id });
  });
  app2.post("/api/exam/reset-sessions", async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas salah." });
      return;
    }
    state.sessions = [];
    await saveState();
    res.json({ ok: true });
  });
  app2.post("/api/sessions/start", async (req, res) => {
    const examId = String(req.body?.examId ?? "").trim();
    const studentName = String(req.body?.studentName ?? "").trim();
    const absenNumber = String(req.body?.absenNumber ?? "").trim();
    const token = String(req.body?.token ?? "").trim().toUpperCase();
    const exam = state.exams.find((ex) => ex.id === examId);
    if (!exam) {
      res.status(404).json({ error: "Pilih jadwal ulangan terlebih dahulu." });
      return;
    }
    const now = Date.now();
    const status = computeExamStatus(exam, now);
    if (status === "no_form") {
      res.status(400).json({
        error: "Link Google Form untuk ulangan ini belum diisi oleh Guru."
      });
      return;
    }
    if (status === "closed") {
      res.status(403).json({ error: "Ulangan ini sedang ditutup oleh Guru Pengawas." });
      return;
    }
    if (status === "upcoming") {
      res.status(403).json({
        error: "Ulangan ini belum memasuki jadwal waktu mulai."
      });
      return;
    }
    if (status === "ended") {
      res.status(403).json({
        error: "Jadwal waktu ulangan ini sudah berakhir."
      });
      return;
    }
    if (studentName.length < 2) {
      res.status(400).json({ error: "Masukkan nama lengkap siswa." });
      return;
    }
    if (!absenNumber) {
      res.status(400).json({ error: "Masukkan nomor absen siswa." });
      return;
    }
    if (!token || !safeEqual(token, exam.entryToken.toUpperCase())) {
      res.status(401).json({ error: "Token Ujian salah. Periksa kembali token dari Guru." });
      return;
    }
    let session = state.sessions.find(
      (s) => s.examId === exam.id && s.absenNumber.toLowerCase() === absenNumber.toLowerCase() && s.studentName.toLowerCase() === studentName.toLowerCase() && s.status !== "finished"
    );
    if (!session) {
      const durationMs = exam.durationMinutes * 60 * 1e3;
      const lockMs = exam.lockSubmitMinutes * 60 * 1e3;
      session = {
        id: crypto.randomUUID(),
        examId: exam.id,
        examTitle: exam.examTitle,
        subject: exam.subject,
        studentName,
        absenNumber,
        startedAt: now,
        endsAt: now + durationMs,
        unlockAt: now + lockMs,
        status: "active",
        violations: [],
        lastHeartbeat: now
      };
      state.sessions.push(session);
    } else {
      session.lastHeartbeat = now;
    }
    await saveState();
    res.json(buildActiveSessionResponse(session, exam, now));
  });
  function resolveSessionWithTokenFallback(sessionId, rawToken) {
    let session = state.sessions.find((s) => s.id === sessionId) || null;
    const envelope = verifySessionToken(rawToken);
    if (!session && envelope && envelope.session.id === sessionId) {
      session = envelope.session;
      state.sessions.push(session);
    }
    return { session, envelope };
  }
  app2.get("/api/sessions/:id", (req, res) => {
    const tokenHeader = String(req.headers["x-session-token"] ?? "");
    const { session, envelope } = resolveSessionWithTokenFallback(req.params.id, tokenHeader);
    if (!session) {
      res.status(404).json({ error: "Sesi ujian tidak ditemukan." });
      return;
    }
    const exam = state.exams.find((ex) => ex.id === session.examId);
    const now = Date.now();
    session.lastHeartbeat = now;
    res.json(buildActiveSessionResponse(session, exam, now, envelope));
  });
  app2.post("/api/sessions/:id/violation", async (req, res) => {
    const tokenHeader = String(
      req.headers["x-session-token"] ?? req.body?.sessionToken ?? ""
    );
    const { session, envelope } = resolveSessionWithTokenFallback(req.params.id, tokenHeader);
    if (!session) {
      res.status(404).json({ error: "Sesi tidak ditemukan." });
      return;
    }
    if (session.status === "finished") {
      res.json({ session });
      return;
    }
    const exam = state.exams.find((ex) => ex.id === session.examId);
    const maxViolations = exam?.maxViolationsBeforeLock ?? envelope?.maxViolationsBeforeLock ?? 3;
    const reason = String(req.body?.reason ?? "Keluar dari jendela ujian").trim();
    const now = Date.now();
    const last = session.violations[session.violations.length - 1];
    if (!last || now - last.time > 1500) {
      session.violations.push({ time: now, reason });
      const activeStrikes = session.violations.filter((v) => !v.forgiven).length;
      if (activeStrikes >= maxViolations) {
        session.status = "locked";
      }
      await saveState();
    }
    const activePayload = buildActiveSessionResponse(session, exam, now, envelope);
    res.json({
      session,
      maxViolations,
      sessionToken: activePayload.sessionToken
    });
  });
  app2.post("/api/sessions/:id/unlock", async (req, res) => {
    const session = state.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: "Sesi tidak ditemukan." });
      return;
    }
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    session.violations = session.violations.map((v) => ({ ...v, forgiven: true }));
    session.status = "active";
    await saveState();
    res.json({ session });
  });
  app2.post("/api/sessions/:id/finish", async (req, res) => {
    const tokenHeader = String(
      req.headers["x-session-token"] ?? req.body?.sessionToken ?? ""
    );
    let { session, envelope } = resolveSessionWithTokenFallback(req.params.id, tokenHeader);
    if (!session && req.body?.sessionSnapshot && typeof req.body.sessionSnapshot === "object") {
      const snap = req.body.sessionSnapshot;
      if (snap.examId && snap.studentName) {
        session = {
          id: req.params.id,
          examId: String(snap.examId),
          examTitle: String(snap.examTitle || "Ulangan"),
          subject: String(snap.subject || "Mapel"),
          studentName: String(snap.studentName),
          absenNumber: String(snap.absenNumber || "-"),
          startedAt: Number(snap.startedAt) || Date.now(),
          endsAt: Number(snap.endsAt) || Date.now(),
          unlockAt: Number(snap.unlockAt) || Date.now(),
          status: "active",
          violations: Array.isArray(snap.violations) ? snap.violations : [],
          lastHeartbeat: Date.now()
        };
        state.sessions.push(session);
      }
    }
    if (!session) {
      res.status(404).json({ error: "Sesi tidak ditemukan." });
      return;
    }
    const now = Date.now();
    const proctorPin = String(req.body?.proctorPin ?? "").trim();
    const isProctorOverride = proctorPin && safeEqual(proctorPin, state.settings.proctorPin);
    if (now < session.unlockAt && !isProctorOverride) {
      const remainingSec = Math.ceil((session.unlockAt - now) / 1e3);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      res.status(403).json({
        error: `Belum bisa kirim/selesai. Waktu tunggu tersisa ${mins} menit ${secs} detik lagi.`
      });
      return;
    }
    session.status = "finished";
    session.finishedAt = now;
    const exam = state.exams.find((ex) => ex.id === session.examId);
    if (exam) {
      upsertStudentResult(exam, {
        studentName: session.studentName,
        absenNumber: session.absenNumber,
        rawScore: 0,
        itemScores: [],
        submittedAt: now,
        source: "kiosk"
      });
    }
    await saveState();
    const activePayload = buildActiveSessionResponse(session, exam, now, envelope);
    res.json({ session, sessionToken: activePayload.sessionToken });
  });
  app2.post("/api/sessions/:id/force-unlock-submit", async (req, res) => {
    const session = state.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: "Sesi tidak ditemukan." });
      return;
    }
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: "PIN Pengawas atau sesi Google tidak valid." });
      return;
    }
    session.unlockAt = Date.now() - 1e3;
    await saveState();
    res.json({ session });
  });
  return app2;
}

// server/vercel.ts
var app = createApp();
function handler(req, res) {
  const rawUrl = req.url || "/";
  try {
    const parsed = new URL(rawUrl, "http://localhost");
    const forwardedPath = parsed.searchParams.get("__vercel_path");
    if (forwardedPath !== null) {
      parsed.searchParams.delete("__vercel_path");
      const qs = parsed.searchParams.toString();
      const cleanSubPath = forwardedPath.replace(/^\/+/, "");
      req.url = `/api${cleanSubPath ? `/${cleanSubPath}` : ""}${qs ? `?${qs}` : ""}`;
    } else if (parsed.pathname === "/api/index") {
      req.url = `/api/health${parsed.search}`;
    }
  } catch {
  }
  return app(req, res);
}
export {
  handler as default
};
