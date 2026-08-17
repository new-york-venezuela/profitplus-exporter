import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { SMTPError, TemplateNotFoundError } from '@/lib/errors/password-reset';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: parseInt(process.env.SMTP_PORT || '587') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async send(
    to: string,
    templateName: string,
    data: Record<string, string>
  ): Promise<void> {
    try {
      // Build template file path
      const templatePath = path.join(
        process.cwd(),
        'src',
        'lib',
        'email',
        'templates',
        `${templateName}.hbs`
      );

      // Read file from disk
      let templateContent: string;
      try {
        templateContent = fs.readFileSync(templatePath, 'utf-8');
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          throw new TemplateNotFoundError(templateName);
        }
        throw error;
      }

      // Compile Handlebars template
      const template = Handlebars.compile(templateContent);

      // Render template with data
      const html = template(data);

      // Get subject for template
      const subject = this.getSubjectForTemplate(templateName);

      // Send via SMTP
      await this.transporter.sendMail({
        from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error;
      }
      if (error instanceof SMTPError) {
        throw error;
      }
      // Wrap other errors as SMTPError
      const message =
        error instanceof Error ? error.message : String(error);
      throw new SMTPError(`Failed to send email: ${message}`);
    }
  }

  private getSubjectForTemplate(templateName: string): string {
    const subjects: Record<string, string> = {
      'password-reset': 'Reset Your Password',
    };
    return subjects[templateName] || 'Email from ProfitPlus Exporter';
  }
}
