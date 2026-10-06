import { Link, useForm } from '@inertiajs/react';

export default function Index({ documents }) {
    const form = useForm({ title: '' });

    return (
        <main className="mx-auto max-w-2xl p-8">
            <h1 className="mb-6 text-2xl font-semibold">Documents (React)</h1>

            <form
                className="mb-8 flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/react/documents');
                }}
            >
                <input
                    value={form.data.title}
                    onChange={(event) => form.setData('title', event.target.value)}
                    className="flex-1 rounded border px-3 py-2"
                    placeholder="New document title"
                />
                <button className="rounded bg-black px-4 py-2 text-white" disabled={form.processing}>
                    Create
                </button>
            </form>

            <ul className="space-y-2">
                {documents.map((document) => (
                    <li key={document.uuid}>
                        <Link href={`/react/documents/${document.uuid}`} className="text-blue-600 underline">
                            {document.title}
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
