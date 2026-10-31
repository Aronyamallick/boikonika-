'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/field';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';

export function InteractiveDemos({ labels }: { labels: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setOpen(true)}>{labels.openDialog}</Button>
        <Button variant="secondary" onClick={() => toast.show(labels.saved!, 'success')}>
          {labels.toastSuccess}
        </Button>
        <Button variant="outline" onClick={() => toast.show(labels.error!, 'danger')}>
          {labels.toastError}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={labels.dialogTitle}
        closeLabel={labels.close!}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button onClick={() => setOpen(false)}>{labels.confirm}</Button>
          </>
        }
      >
        <p className="text-fg-muted">{labels.dialogText}</p>
      </Dialog>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={labels.email} hint={labels.emailHint} required>
          {(p) => <Input type="email" placeholder="name@example.com" {...p} />}
        </Field>
        <Field label={labels.phone} error={labels.phoneError}>
          {(p) => <Input inputMode="tel" defaultValue="01212" {...p} />}
        </Field>
        <Field label={labels.language}>
          {(p) => (
            <Select {...p}>
              <option>বাংলা</option>
              <option>English</option>
            </Select>
          )}
        </Field>
        <Field label={labels.bio}>{(p) => <Textarea {...p} />}</Field>
        <Checkbox label={labels.terms!} />
      </div>
      <Tabs
        tabs={[
          { label: labels.tab1, content: <p className="text-fg-muted">{labels.tab1Text}</p> },
          { label: labels.tab2, content: <p className="text-fg-muted">{labels.tab2Text}</p> },
        ]}
      />
    </div>
  );
}
