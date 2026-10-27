/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import PortalAccessLink from '../PortalAccessLink';

const props = { tenantId: '00000000-0000-4000-8000-000000000001', courseId: '00000000-0000-4000-8000-000000000002', studentPartyId: '00000000-0000-4000-8000-000000000003' };
const guardianId = '00000000-0000-4000-8000-000000000004';
const context = { ...props, guardians: [{ guardianPartyId: guardianId, guardianLabel: 'Synthetic Guardian' }] };
const originalFetch = globalThis.fetch;
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data } as Response);
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

async function selectGuardian() {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Người giám hộ' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Synthetic Guardian' }));
}

it('requires explicit guardian and displays only a validated local Portal URL', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(reply({ success: true, data: context }))
    .mockResolvedValueOnce(reply({ success: true, expiresInSeconds: 86400, portalUrl: '/portal/education/payload.' + 'a'.repeat(64) }));
  globalThis.fetch = fetcher;
  render(<PortalAccessLink {...props} />);
  expect(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' })).toBeDisabled();
  await screen.findByRole('combobox', { name: 'Người giám hộ' });
  expect(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' })).toBeDisabled();
  await selectGuardian();
  fireEvent.click(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' }));
  expect(await screen.findByRole('link', { name: 'Mở Portal phụ huynh' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ courseId: props.courseId, studentPartyId: props.studentPartyId, guardianPartyId: guardianId });
});

it.each([null, { ...context, tenantId: guardianId }, { ...context, guardians: [] }])('fails closed for malformed/foreign issuer context %#', async data => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply({ success: true, data }));
  render(<PortalAccessLink {...props} />);
  await screen.findByText(/Chưa thể cấp liên kết phụ huynh/);
  expect(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' })).toBeDisabled();
});

it('removes previous guardian success and link when another guardian is selected without a second POST', async () => {
  const choices = { ...context, guardians: [...context.guardians, { guardianPartyId: props.courseId, guardianLabel: 'Synthetic Guardian Two' }] };
  const fetcher = jest.fn().mockResolvedValueOnce(reply({ success: true, data: choices })).mockResolvedValueOnce(reply({ success: true, expiresInSeconds: 86400, portalUrl: '/portal/education/payload.' + 'a'.repeat(64) }));
  globalThis.fetch = fetcher;
  render(<PortalAccessLink {...props} />); await selectGuardian();
  fireEvent.click(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' }));
  await screen.findByRole('link', { name: 'Mở Portal phụ huynh' });
  fireEvent.click(screen.getByRole('combobox', { name: 'Người giám hộ' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Synthetic Guardian Two' }));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Chưa cấp liên kết mới');
  expect(screen.getByRole('status')).not.toHaveTextContent('Đã cấp');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(['https://foreign.invalid/portal', '//foreign.invalid/portal', '/portal/education/not-signed'])('never displays an unsafe or malformed issuer URL: %s', async portalUrl => {
  globalThis.fetch = jest.fn().mockResolvedValueOnce(reply({ success: true, data: context })).mockResolvedValueOnce(reply({ success: true, expiresInSeconds: 86400, portalUrl }));
  render(<PortalAccessLink {...props} />); await selectGuardian();
  fireEvent.click(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' }));
  await screen.findByText(/Không cấp được liên kết/); expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('does not show the previous student link after a binding change or late POST', async () => {
  let complete: (value: Response) => void = () => undefined;
  globalThis.fetch = jest.fn().mockResolvedValueOnce(reply({ success: true, data: context }))
    .mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
    .mockResolvedValueOnce(reply({ success: false }, false));
  const view = render(<PortalAccessLink {...props} />); await selectGuardian();
  fireEvent.click(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' }));
  view.rerender(<PortalAccessLink {...props} studentPartyId={guardianId} />);
  await act(async () => complete(reply({ success: true, expiresInSeconds: 86400, portalUrl: '/portal/education/payload.' + 'a'.repeat(64) })));
  await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Cấp liên kết phụ huynh' })).toBeDisabled();
});
