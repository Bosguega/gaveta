export type SuccessBody = {
    success: true;
    html: string;
    source: "sefaz" | "cache";
    status: number;
};

export type ErrorBody = {
    success: false;
    error: string;
    message: string;
    status: number;
};

export type NfceBody = SuccessBody | ErrorBody;

export type SefazOk = { ok: true; html: string; status: number };
export type SefazErr = { ok: false; body: ErrorBody };
export type SefazResult = SefazOk | SefazErr;