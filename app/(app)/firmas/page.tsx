'use client';

import React, { useState, useRef } from 'react';

interface SignatureData {
    fullName: string;
    role: string;
    department: string;
    companyName: string;
    phone: string;
    showWhatsapp: boolean;
    whatsapp: string;
    email: string;
    legalName: string;
    rif: string;
    addressLine1: string;
    addressLine2: string;
}

export default function CorporateSignaturePage() {
    const [formData, setFormData] = useState<SignatureData>({
        fullName: 'Eugenio Doñaque',
        role: 'Director',
        department: '',
        companyName: 'Alimentos New York',
        phone: '04223857427',
        showWhatsapp: false,
        whatsapp: '+58 414 155 2451',
        email: 'eugenio@alimentosnewyork.com',
        legalName: 'New York Cheese Cake C.A.',
        rif: 'J-00184590-9',
        addressLine1: 'Calle 10, Edif. JM, Zona Industrial de La Urbina',
        addressLine2: '1070, Caracas, Venezuela',
    });

    const [copiedType, setCopiedType] = useState<'rich' | 'html' | null>(null);
    const [activeTab, setActiveTab] = useState<'outlook' | 'mailcow'>('outlook');
    const signatureRef = useRef<HTMLDivElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const formatPhoneForLink = (phone: string) => phone.replace(/[^\d+]/g, '');

    const getSignatureHTML = () => {
        const cleanPhone = formatPhoneForLink(formData.phone);
        const cleanWa = formatPhoneForLink(formData.whatsapp);

        // Construcción del Cargo + Departamento
        const displayRole = [formData.role, formData.department].filter(Boolean).join(' | ');

        return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #333333; max-width: 550px; width: 100%; border-collapse: collapse;">
  <tbody>
    <tr>
      <!-- Izquierda: Nombre y Cargo -->
      <td valign="middle" width="50%" align="left" style="padding-bottom: 15px; border-bottom: 1px solid #e5e5e5;">
        <div style="font-size: 32px; font-weight: bold; color: #111111; line-height: 1.2; margin: 0; padding: 0;">${formData.fullName || 'Nombre Apellido'}</div>
        <div style="font-size: 12px; color: #666666; margin-top: 3px; margin-bottom: 0;">${displayRole || 'Cargo'}</div>
      </td>
      
      <!-- Derecha: Logo Corporativo -->
      <td valign="middle" width="50%" align="right" style="padding-bottom: 15px; border-bottom: 1px solid #e5e5e5;">
        <a href="https://www.alimentosnewyork.com?utm_medium=email&utm_source=mail-client&utm_content=logo" target="_blank" style="text-decoration: none; display: inline-block;">
          <img src="https://raw.githubusercontent.com/new-york-venezuela/web/6e0c301ac3ddbbf51b34bdf4649f15217b09c619/public/logos/logo-mail.png" alt="Company Logo" width="100" style="display: block; border: 0; max-width: 100%; height: auto;">
        </a>
      </td>
    </tr>

    <tr>
      <!-- Izquierda: Datos de Contacto -->
      <td valign="top" width="50%" align="left" style="padding-top: 15px;">
        <div style="font-size: 12px; color: #555555; line-height: 1.6; text-align: left; margin: 0;">
          <strong style="color: #111111;">${formData.companyName || 'Empresa'}</strong><br>
          ${formData.phone ? `<strong style="color: #111111;">T:&nbsp;</strong><a href="tel:${cleanPhone}" style="color: #555555; text-decoration: none;">${formData.phone}</a><br>` : ''}
          ${formData.showWhatsapp && formData.whatsapp ? `<strong style="color: #111111;">WA:&nbsp;</strong><a href="https://wa.me/${cleanWa.replace('+', '')}" style="color: #555555; text-decoration: none;">${formData.whatsapp}</a><br>` : ''}
          ${formData.email ? `<strong style="color: #111111;">E:&nbsp;</strong><a href="mailto:${formData.email}" style="color: #555555; text-decoration: none;">${formData.email}</a>` : ''}
        </div>
      </td>

      <!-- Derecha: Datos Legales, Dirección y Redes Alineadas -->
      <td valign="top" width="50%" align="right" style="padding-top: 15px;">
        <div style="font-size: 12px; color: #555555; line-height: 1.6; text-align: right; margin: 0;">
          <strong style="color: #111111;">${formData.legalName}</strong><br>
          ${formData.rif}<br>
          ${formData.addressLine1}<br>
          ${formData.addressLine2}
        </div>

        <!-- Contenedor estricto para iconos sociales en horizontal -->
        <div style="margin-top: 8px; text-align: right; line-height: 1; font-size: 0;">
          <a href="https://www.alimentosnewyork.com?utm_medium=email&utm_source=mail-client&utm_content=web-icon" target="_blank" style="text-decoration: none; display: inline-block; margin-left: 8px;">
            <img src="https://raw.githubusercontent.com/new-york-venezuela/web/d92334e7fb2a75abd4a5dd92e5727cad07bfa863/public/logos/world-wide-web.png" alt="Web" width="16" height="16" style="border: 0; display: inline-block; vertical-align: middle; width: 16px; height: 16px;">
          </a>
          <a href="https://linkedin.com/company/alimentos-new-york" target="_blank" style="text-decoration: none; display: inline-block; margin-left: 8px;">
            <img src="https://raw.githubusercontent.com/new-york-venezuela/web/6e0c301ac3ddbbf51b34bdf4649f15217b09c619/public/logos/linkedin-mail.png" alt="LinkedIn" width="16" height="16" style="border: 0; display: inline-block; vertical-align: middle; width: 16px; height: 16px;">
          </a>
          <a href="https://instagram.com/alimentosnewyork" target="_blank" style="text-decoration: none; display: inline-block; margin-left: 8px;">
            <img src="https://raw.githubusercontent.com/new-york-venezuela/web/6e0c301ac3ddbbf51b34bdf4649f15217b09c619/public/logos/ig-mail.png" alt="Instagram" width="16" height="16" style="border: 0; display: inline-block; vertical-align: middle; width: 16px; height: 16px;">
          </a>
        </div>
      </td>
    </tr>
  </tbody>
</table>
`.trim();
    };

    const copyRichText = async () => {
        try {
            const html = getSignatureHTML();
            const blob = new Blob([html], { type: 'text/html' });
            const data = [new ClipboardItem({ 'text/html': blob })];
            await navigator.clipboard.write(data);
            setCopiedType('rich');
            setTimeout(() => setCopiedType(null), 3000);
        } catch (err) {
            console.error('Error al copiar texto enriquecido:', err);
        }
    };

    const copyRawHTML = async () => {
        try {
            await navigator.clipboard.writeText(getSignatureHTML());
            setCopiedType('html');
            setTimeout(() => setCopiedType(null), 3000);
        } catch (err) {
            console.error('Error al copiar código HTML:', err);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-10">
            <header className="border-b pb-4">
                <h1 className="text-2xl font-bold text-slate-900">Generador de Firma Corporativa</h1>
                <p className="text-sm text-slate-600 mt-1">
                    Ingresa tus datos personales para generar e instalar tu firma institucional.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Formulario */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">1. Tus Datos de Contacto</h2>

                    <div className="space-y-3 text-sm">
                        <div>
                            <label className="block text-slate-700 font-medium mb-1">Nombre Completo</label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                className="w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-slate-700 font-medium mb-1">Cargo</label>
                                <input
                                    type="text"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    className="w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-700 font-medium mb-1">Departamento (Opcional)</label>
                                <input
                                    type="text"
                                    name="department"
                                    placeholder="Ej. Ventas"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    className="w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-slate-700 font-medium mb-1">Teléfono (T)</label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    className="w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-700 font-medium mb-1">Correo Electrónico (E)</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className="w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Toggle WhatsApp Opcional */}
                        <div className="pt-2 border-t mt-2">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                                <input
                                    type="checkbox"
                                    name="showWhatsapp"
                                    checked={formData.showWhatsapp}
                                    onChange={handleInputChange}
                                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 h-4 width-4"
                                />
                                Incluir número de WhatsApp (WA)
                            </label>

                            {formData.showWhatsapp && (
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        name="whatsapp"
                                        placeholder="+58 000 000 0000"
                                        value={formData.whatsapp}
                                        onChange={handleInputChange}
                                        className="w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Vista Previa */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">2. Vista Previa</h2>

                        <div className="border border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 flex items-center justify-center min-h-[180px] overflow-x-auto">
                            <div
                                ref={signatureRef}
                                dangerouslySetInnerHTML={{ __html: getSignatureHTML() }}
                            />
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <button
                            onClick={copyRichText}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            📋 Copiar Firma (Texto Enriquecido)
                        </button>

                        <button
                            onClick={copyRawHTML}
                            className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                            &lt;/&gt; Copiar Código HTML Bruto
                        </button>

                        {copiedType && (
                            <p className="text-center text-xs font-semibold text-emerald-600 bg-emerald-50 py-1.5 rounded border border-emerald-200">
                                {copiedType === 'rich' ? '¡Firma copiada al portapapeles!' : '¡Código HTML copiado!'}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Instructivo */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">3. Instructivo de Configuración</h2>
                    <p className="text-sm text-slate-600">Instalación en clientes corporativos.</p>
                </div>

                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('outlook')}
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                            activeTab === 'outlook'
                                ? 'border-slate-900 text-slate-900'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Microsoft Outlook
                    </button>
                    <button
                        onClick={() => setActiveTab('mailcow')}
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                            activeTab === 'mailcow'
                                ? 'border-slate-900 text-slate-900'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Mailcow Webmail
                    </button>
                </div>

                <div className="text-sm text-slate-700 leading-relaxed">
                    {activeTab === 'outlook' ? (
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Haz clic en <strong>&ldquo;Copiar Firma (Texto Enriquecido)&rdquo;</strong>.</li>
                            <li>Abre Outlook y ve a <strong>Archivo &gt; Opciones &gt; Correo &gt; Firmas</strong>.</li>
                            <li>Crea una nueva firma e ingresa un nombre.</li>
                            <li>En el cuadro de texto, pega directamente con <kbd className="bg-slate-100 border px-1 rounded">Ctrl + V</kbd>.</li>
                            <li>Guarda los cambios.</li>
                        </ol>
                    ) : (
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Haz clic en <strong>&ldquo;Copiar Firma (Texto Enriquecido)&rdquo;</strong>.</li>
                            <li>Ve a tu Webmail de Mailcow en <strong>Ajustes &gt; Correo &gt; Firmas</strong>.</li>
                            <li>Pega el contenido en el editor e indica la cuenta por defecto.</li>
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
}