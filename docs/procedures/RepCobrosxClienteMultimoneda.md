# SP: RepCobrosxClienteMultimoneda
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <28-09-10>
-- Modified date: <2018-04-20>
-- Description:	<Cobros por Cliente>
-- =============================================
CREATE PROCEDURE [dbo].[RepCobrosxClienteMultimoneda]
      -- Add the parameters for the stored procedure here
    @sNum_pag_d CHAR(20) = NULL ,
    @sNum_pag_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(16) = NULL ,
    @sCo_Ven_h CHAR(16) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
	@sCo_Moneda_Rep CHAR (6) = NULL,
    @sCo_zon_d CHAR(6) = NULL ,
    @sCo_zon_h CHAR(6) = NULL ,
    @sCo_seg_d CHAR(6) = NULL ,
    @sCo_seg_h CHAR(6) = NULL ,
    @sCondic CHAR(2) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)

        IF ( @sCondic = 'TD' ) 
            SET @sCondic = NULL
      
        IF ( @sCondic = 'SI' ) 
            SET @sCondic = 1 

        IF ( @sCondic = 'NO' ) 
            SET @sCondic = 0
      
             Declare @MonedaBase char(6)
             Select @MonedaBase = g_moneda from par_emp

             if (@sCo_Moneda_Rep is null)
                    set @sCo_Moneda_Rep = @MonedaBase

        SET DATEFORMAT DMY   
      
        SELECT
            *, @sCo_Moneda_Rep as Mon_Rep, @sCo_mone as Mon_Fil
        FROM
            ( SELECT
                P.cob_num, CASE WHEN ( TP.tipo_mov = 'CR'
                                       AND DC.co_tipo_doc = 'ADEL'
                                       AND PD.mont_cob > 0.00
                                     )
                                     OR ( TP.tipo_mov = 'CR'
                                          AND DC.co_tipo_doc <> 'ADEL'
                                        ) THEN PD.mont_cob
                                ELSE 0.00
                           END * case when p.anulado=1 then 0 else 1 end AS abono, 
						   CASE WHEN ( TP.tipo_mov = 'CR'
                                                     AND DC.co_tipo_doc = 'ADEL'
```
