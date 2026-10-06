<script setup>
import { Link, useForm } from '@inertiajs/vue3';
import { useLive } from '@freepeace13/inertia-live/vue';

const props = defineProps({ document: Object, comments: Array });

const { status, lastSyncedAt, pause, resume } = useLive();

const rename = useForm({ title: props.document.title });
const comment = useForm({ body: '' });

const submitComment = () => comment.post(`/documents/${props.document.uuid}/comments`, {
    preserveScroll: true,
    onSuccess: () => comment.reset(),
});
</script>

<template>
    <main class="mx-auto max-w-2xl p-8">
        <Link href="/documents" class="text-sm text-blue-600 underline">All documents</Link>

        <p class="mt-4 text-sm text-gray-500" data-testid="live-status">
            Live: {{ status }}<span v-if="lastSyncedAt"> · synced {{ lastSyncedAt.toLocaleTimeString() }}</span>
        </p>

        <h1 class="mt-2 text-3xl font-semibold" data-testid="title">{{ document.title }}</h1>

        <!-- Pause live reloads while editing so an incoming change cannot interrupt typing. -->
        <form class="mt-4 flex gap-2" @submit.prevent="rename.put(`/documents/${document.uuid}`)">
            <input v-model="rename.title" class="flex-1 rounded border px-3 py-2" @focus="pause" @blur="resume" />
            <button class="rounded bg-black px-4 py-2 text-white" :disabled="rename.processing">Rename</button>
        </form>

        <h2 class="mt-10 text-lg font-medium">Comments</h2>

        <form class="mt-2 flex gap-2" @submit.prevent="submitComment">
            <input v-model="comment.body" class="flex-1 rounded border px-3 py-2" placeholder="Add a comment" @focus="pause" @blur="resume" />
            <button class="rounded bg-black px-4 py-2 text-white" :disabled="comment.processing">Post</button>
        </form>

        <ul class="mt-4 space-y-2" data-testid="comments">
            <li v-for="item in comments" :key="item.id" class="rounded border px-3 py-2">{{ item.body }}</li>
        </ul>
    </main>
</template>
