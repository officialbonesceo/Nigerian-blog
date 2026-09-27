import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
      });
    }
  }
  return appInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    const app = getFirebaseApp();
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    dbInstance = getFirestore(app, databaseId);
  }
  return dbInstance;
}

/**
 * Generates an ISO week string (e.g. "2026-W39")
 */
export function getCurrentWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export interface WeeklyArticleView {
  docId: string;
  weekKey: string;
  articleSlug: string;
  articleTitle: string;
  category: string;
  imageUrl: string;
  viewsCount: number;
  lastViewedAt: number;
}

/**
 * Records a real, authentic article read in Firestore.
 * Uses sessionStorage to prevent duplicate counts from the same browser tab refresh.
 */
export async function recordArticleView(article: {
  slug: string;
  title: string;
  category?: string;
  imageUrl?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const currentWeek = getCurrentWeekKey();
  const sessionKey = `viewed_${currentWeek}_${article.slug}`;

  // Prevent multiple counts within the same browsing session (30-minute cooldown)
  const lastRecorded = sessionStorage.getItem(sessionKey);
  const now = Date.now();
  if (lastRecorded && now - parseInt(lastRecorded, 10) < 1800000) {
    return false;
  }

  try {
    const db = getDb();
    const docId = `${currentWeek}_${article.slug.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
    const docRef = doc(db, 'weekly_article_views', docId);

    await setDoc(
      docRef,
      {
        weekKey: currentWeek,
        articleSlug: article.slug,
        articleTitle: article.title,
        category: article.category || 'naija-news',
        imageUrl: article.imageUrl || '',
        viewsCount: increment(1),
        lastViewedAt: now,
      },
      { merge: true }
    );

    sessionStorage.setItem(sessionKey, now.toString());
    return true;
  } catch (err) {
    console.warn('[Firestore] Failed to increment weekly view count:', err);
    return false;
  }
}

/**
 * Retrieves the top verified read stories for the current week from Firestore
 */
export async function fetchMostReadThisWeek(maxResults: number = 5): Promise<WeeklyArticleView[]> {
  try {
    const db = getDb();
    const currentWeek = getCurrentWeekKey();
    const viewsRef = collection(db, 'weekly_article_views');

    const q = query(
      viewsRef,
      where('weekKey', '==', currentWeek),
      orderBy('viewsCount', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const results: WeeklyArticleView[] = [];

    snapshot.forEach((d) => {
      const data = d.data();
      results.push({
        docId: d.id,
        weekKey: data.weekKey,
        articleSlug: data.articleSlug,
        articleTitle: data.articleTitle,
        category: data.category,
        imageUrl: data.imageUrl,
        viewsCount: Number(data.viewsCount) || 1,
        lastViewedAt: Number(data.lastViewedAt) || 0,
      });
    });

    return results;
  } catch (err) {
    console.warn('[Firestore] Could not fetch weekly most-read articles:', err);
    return [];
  }
}

/**
 * Cleans up records from previous weeks to keep Firestore lean and free of old data
 */
export async function cleanupExpiredWeeklyViews(): Promise<number> {
  try {
    const db = getDb();
    const currentWeek = getCurrentWeekKey();
    const viewsRef = collection(db, 'weekly_article_views');

    const q = query(viewsRef, where('weekKey', '<', currentWeek), limit(20));
    const snapshot = await getDocs(q);

    let deleted = 0;
    const deletePromises = snapshot.docs.map((d) => {
      deleted++;
      return deleteDoc(d.ref);
    });

    await Promise.all(deletePromises);
    return deleted;
  } catch (err) {
    console.warn('[Firestore] Failed cleaning up old week views:', err);
    return 0;
  }
}

export interface UserOpinionComment {
  id: string;
  articleSlug: string;
  articleTitle: string;
  parentId?: string | null;
  replyToUser?: string | null;
  userName: string;
  content: string;
  sentiment: 'agree' | 'disagree' | 'neutral' | 'perspective';
  createdAt: number;
  likesCount: number;
}

/**
 * Retrieves community opinions and comments for a given article
 */
export async function fetchArticleComments(articleSlug: string): Promise<UserOpinionComment[]> {
  try {
    const db = getDb();
    const commentsRef = collection(db, 'comments');
    const q = query(
      commentsRef,
      where('articleSlug', '==', articleSlug),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const comments: UserOpinionComment[] = [];

    snapshot.forEach((d) => {
      const data = d.data();
      const rawCreated = data.createdAt;
      let timestamp = Date.now();
      if (rawCreated?.toMillis) {
        timestamp = rawCreated.toMillis();
      } else if (typeof rawCreated === 'number') {
        timestamp = rawCreated;
      } else if (typeof rawCreated === 'string') {
        const parsed = new Date(rawCreated).getTime();
        if (!isNaN(parsed)) timestamp = parsed;
      }

      comments.push({
        id: d.id,
        articleSlug: data.articleSlug,
        articleTitle: data.articleTitle || '',
        parentId: data.parentId || null,
        replyToUser: data.replyToUser || null,
        userName: data.userName || 'Anonymous Reader',
        content: data.content || '',
        sentiment: data.sentiment || 'perspective',
        createdAt: timestamp,
        likesCount: Number(data.likesCount) || 0,
      });
    });

    // In-memory sort by newest first (avoids needing a Firestore composite index)
    comments.sort((a, b) => b.createdAt - a.createdAt);

    return comments;
  } catch (err) {
    console.warn('[Firestore] Could not load comments for article:', articleSlug, err);
    return [];
  }
}

/**
 * Submits a new reader opinion or reply to Firestore
 */
export async function postArticleComment(opinion: {
  id?: string;
  articleSlug: string;
  articleTitle: string;
  parentId?: string | null;
  replyToUser?: string | null;
  userName: string;
  content: string;
  sentiment?: 'agree' | 'disagree' | 'neutral' | 'perspective';
}): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const db = getDb();
    const cleanName = (opinion.userName || 'Verified Reader').trim().slice(0, 50);
    const cleanContent = (opinion.content || '').trim().slice(0, 1500);

    if (cleanContent.length < 3) {
      return { success: false, error: 'Opinion must be at least 3 characters long.' };
    }

    const commentsRef = collection(db, 'comments');
    const commentData: any = {
      articleSlug: opinion.articleSlug,
      articleTitle: opinion.articleTitle,
      parentId: opinion.parentId || null,
      replyToUser: opinion.replyToUser || null,
      userName: cleanName,
      content: cleanContent,
      sentiment: opinion.sentiment || 'perspective',
      createdAt: serverTimestamp(),
      likesCount: 0,
    };

    if (opinion.id) {
      const docRef = doc(commentsRef, opinion.id);
      await setDoc(docRef, commentData);
      return { success: true, commentId: opinion.id };
    } else {
      const docRef = await addDoc(commentsRef, commentData);
      return { success: true, commentId: docRef.id };
    }
  } catch (err: any) {
    console.error('[Firestore] Error posting comment:', err);
    return { success: false, error: err.message || 'Failed to submit opinion. Please retry.' };
  }
}

/**
 * Increments the upvote/like count on an opinion
 */
export async function upvoteComment(commentId: string): Promise<boolean> {
  try {
    const db = getDb();
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, {
      likesCount: increment(1),
    });
    return true;
  } catch (err) {
    console.warn('[Firestore] Upvoting comment failed:', err);
    return false;
  }
}
