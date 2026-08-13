# SP: RepDocumentoCXCxClienteNY
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:          SOFTECH SISTEMAS
-- Create date: <2017-06-13>
-- Description:     <Documentos de Venta por Cliente>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCXCxClienteNY]
         @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @sCo_Tip CHAR(6) = NULL ,
    @dFecha_Emis_d DATETIME = NULL ,
    @dFecha_Emis_h DATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Condic CHAR(2) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Moneda_Rep CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'num_doc'


        DECLARE @fechadiff INT ;
        SET @fechadiff = DATEDIFF(dd, 00, GETDATE()) ;

             IF @dFecha_Emis_h IS NOT NULL 
            SET @dFecha_Emis_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_Emis_h))

             Declare @MonedaBase char(6)
             Select @MonedaBase = g_moneda from par_emp

             if (@sCo_Moneda_Rep is null)
                    set @sCo_Moneda_Rep = @MonedaBase       

        SELECT
            DC.nro_doc, DC.co_tipo_doc, 
                    DC.co_ven, DC.co_cli, 
                    dbo.fechasimple(DC.fec_emis) as fec_emis, 
                    dbo.fechasimple(DC.fec_venc) as fec_venc, 
                    DC.anulado,
                    CASE   
                           WHEN @sCo_Moneda_Rep = @MonedaBase THEN 1 -- Ver en moneda Base, el documento ya tiene ese valor
                           WHEN @sCo_Moneda_Rep = DC.co_mone THEN DC.tasa -- Ver en OM, y el documento es en ese OM se respeta la tasa del documento
                           ELSE [dbo].[TasaAUnaFecha](@sCo_Moneda_Rep, 1, DC.fec_emis)  -- Ver en OM y el documento esta en otra moneda
                    END AS tasa, 
            DC.total_neto * ( CASE WHEN DC.anulado = 1 THEN 0 ELSE 1 END ) AS total_neto, 
                    DC.saldo * ( CASE WHEN DC.anulado = 1 THEN 0 ELSE 1 END ) AS
```
