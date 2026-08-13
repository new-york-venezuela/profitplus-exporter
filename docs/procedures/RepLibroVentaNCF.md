# SP: RepLibroVentaNCF
**Tipo**: Reporte
**Módulo**: General

## Código (excerpt)
```sql
---- =============================================
---- Author:		SOFTECH SISTEMAS
---- Create date: <04/22/2019>
---- Last Update: <30/05/2019>
---- Description:	<Reporte de Libro de Ventas NCF>
---- =============================================
CREATE PROCEDURE [dbo].[RepLibroVentaNCF] 
	-- Add the parameters for the stored procedure here
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cco_cliente_d CHAR(16) = NULL ,
    @cco_cliente_h CHAR(16) = NULL ,
    @iCo_numero_d INT = NULL,
    @iCo_numero_h INT = NUll,
    @cCo_Comprobante character (3) = NULL,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
    
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sCo_fecha_h)) 


/*---------------------------------------------------------------------------------------------------------
Esta parte es para obtener los documentos y darle formato a cada registro del libro de ventas
---------------------------------------------------------------------------------------------------------*/

        DECLARE @temp TABLE
            (
              [nro_doc] [char](20) ,
              [co_tipo_doc] [char](6) ,
              [fecha_emis] [smalldatetime] ,
              [fe_us_in] [smalldatetime] ,
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
              [num_comprobante] [char](14) ,
              [fec_comprobante] [smalldatetime] ,
              [descrip1] [varchar](100) ,
```
