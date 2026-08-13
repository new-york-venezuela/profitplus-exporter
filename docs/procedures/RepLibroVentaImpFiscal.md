# SP: RepLibroVentaImpFiscal
**Tipo**: Reporte
**Módulo**: General

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03/23/2011>
-- Description:	<Reporte de Libro de Ventas>
-- =============================================
CREATE PROCEDURE [dbo].[RepLibroVentaImpFiscal] 
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
		--SET NOCOUNT ON;
	
		IF @dFecha_h IS NOT NULL
		BEGIN
            SET @dFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h)) 
		END
/*---------------------------------------------------------------------------------------------------------
Esta parte es para obtener los documentos y darle formato a cada registro del libro de ventas
---------------------------------------------------------------------------------------------------------*/

        DECLARE @temp TABLE
            (
              [nro_doc] [char](20) ,
              [co_tipo_doc] [char](6) ,
              [fecha_emis] [smalldatetime] ,
              [total_neto] [decimal](18, 2) ,
              [co_cli] [char](16) ,
              [cli_des] [char](100) ,
              [r] [char](18) ,
              [contrib] [bit] ,
              [nac] [bit] ,
              [co_sucu_in] [char](6) ,
              [nro_orig] [char](20) ,
              [doc_orig] [char](6) ,
              [aut] [bit] ,
              [co_mone] [char](6) ,
              [n_control] [char](20) ,
              [anulado] [bit] ,
              [fec_reg] [smalldatetime] ,
              [ven_ter] [bit] ,
              [base_imp] [decimal](18, 2) ,
              [tipo_imp] [char](1) ,
              [tasa] [decimal](18, 5) ,
              [monto_imp] [decimal](18, 2) ,
              [doc_afec] [char](20) ,
              [ventas_exentas] [decimal](18, 2) ,
              [base_imponible] [decimal](18, 2) ,
              [monto_ret_imp] [decimal](18, 2) ,
              [num_comprobante] [char](14), [fec_comprobante] [smalldatetime],
              [impfis] [char](20), [impfisfac] [char](20), [imp_nro_z] [char](20), [impfisfacini] [char](20), [impfisfacfin] [char](20),
			  [fe_us_in] [smalldatetime] ,
              [descrip1] [varchar](100),   [base_imp1] [decimal](18, 2),  [monto_imp1] [decimal](18, 2),  [retenido1] [decimal](18, 2),
              [descrip2] [varchar](100),   [base_imp2] [decimal](18, 2),  [monto_imp2] [dec
```
