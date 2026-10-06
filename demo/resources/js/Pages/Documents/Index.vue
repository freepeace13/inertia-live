<script setup>
import { Link, useForm } from '@inertiajs/vue3';

defineProps({ documents: Array });

const form = useForm({ title: '' });
</script>

<template>
    <main class="mx-auto max-w-2xl p-8">
        <h1 class="mb-6 text-2xl font-semibold">Documents</h1>

        <form class="mb-8 flex gap-2" @submit.prevent="form.post('/documents')">
            <input v-model="form.title" class="flex-1 rounded border px-3 py-2" placeholder="New document title" />
            <button class="rounded bg-black px-4 py-2 text-white" :disabled="form.processing">Create</button>
        </form>

        <ul class="space-y-2">
            <li v-for="document in documents" :key="document.uuid">
                <Link :href="`/documents/${document.uuid}`" class="text-blue-600 underline">{{ document.title }}</Link>
            </li>
        </ul>
    </main>
</template>
