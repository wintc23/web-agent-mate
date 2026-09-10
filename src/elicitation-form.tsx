import { useState } from "react";
import { Alert, Button, Form, Input, InputNumber, Select, Space } from "antd";
import type { SupportedLanguage as Language } from "./locales";
import type { UserRequest } from "./agent/protocol";
import { safeExternalUrl, validateElicitation } from "./agent/codex";
import { codexText } from "./codex-i18n";

export function ElicitationForm({ request, language, resolve }: { request: UserRequest; language: Language; resolve: (value: string) => void }) {
  const t = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const [error, setError] = useState("");
  const schema = request.schema;
  const fields = Object.entries<any>(schema?.properties ?? {});
  const url = request.url && safeExternalUrl(request.url);
  const advanced = !request.url && (!schema || schema.type !== "object" || fields.some(([, field]) => !["string", "number", "integer", "boolean", "array"].includes(field.type)));
  const submit = (values: unknown) => {
    try { const content = request.url ? null : validateElicitation(schema!, values); resolve(JSON.stringify({ action: "accept", content })); }
    catch (error) { setError((error as Error).message); }
  };
  return <Form layout="vertical" onFinish={submit} initialValues={Object.fromEntries(fields.filter(([, field]) => field.default !== undefined).map(([key, field]) => [key, field.default]))}>
    {request.url ? <Space direction="vertical"><Button href={url || undefined} target="_blank" rel="noopener noreferrer" disabled={!url}>{t("openUrl")}</Button><small className="ws-path-preview">{url || request.url}</small></Space> : advanced ? <Alert type="info" message={t("formUnsupported")} /> : fields.map(([key, field]) => {
      const enumField = field.type === "array" ? field.items : field;
      const options = (enumField?.oneOf ?? enumField?.anyOf)?.map((item: any) => ({ value: item.const, label: item.title ?? String(item.const) })) ?? enumField?.enum?.map((value: any, i: number) => ({ value, label: enumField.enumNames?.[i] ?? String(value) }));
      return <Form.Item key={key} name={key} label={field.title || key} help={field.description} required={schema?.required?.includes(key)}>
        {options ? <Select aria-label={field.title || key} allowClear mode={field.type === "array" ? "multiple" : undefined} options={options} /> : field.type === "boolean" ? <Select aria-label={field.title || key} allowClear options={[{ value: true, label: t("yes") }, { value: false, label: t("no") }]} /> : ["number", "integer"].includes(field.type) ? <InputNumber aria-label={field.title || key} min={field.minimum} max={field.maximum} precision={field.type === "integer" ? 0 : undefined} /> : <Input aria-label={field.title || key} maxLength={field.maxLength} />}
      </Form.Item>;
    })}
    {error && <Alert type="error" showIcon message={error} />}
    <Space wrap className="ws-codex-form-actions"><Button type="primary" htmlType="submit" disabled={advanced || (!!request.url && !url)}>{t(request.url ? "loginDone" : "submit")}</Button><Button onClick={() => resolve(JSON.stringify({ action: "decline", content: null }))}>{t("decline")}</Button><Button onClick={() => resolve(JSON.stringify({ action: "cancel", content: null }))}>{t("cancel")}</Button></Space>
  </Form>;
}
