# SP: RepOrdenPagoxNumero
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <29-07-10>
 Description:	<Reporte Ordenes de Pago por Número>
 =============================================*/
CREATE PROCEDURE [dbo].[RepOrdenPagoxNumero]
	-- Add the parameters for the stored procedure here
    @sCo_Ord_d CHAR(20) = NULL ,
    @sCo_Ord_h CHAR(20) = NULL ,
    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @sCo_Ben_d CHAR(10) = NULL ,
    @sCo_Ben_h CHAR(10) = NULL ,
    @sStatus CHAR(2) = NULL ,
    @sCo_Cta_d CHAR(6) = NULL ,
    @sCo_Cta_h CHAR(6) = NULL ,
    @sCo_Cja_d CHAR(6) = NULL ,
    @sCo_Cja_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Cta_Egr_d CHAR(20) = NULL ,
    @sCo_Cta_Egr_h CHAR(20) = NULL ,
    @sAnulado CHAR(4) = NULL ,
    @sPag_Autor CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @sFecha_d IS NOT NULL 
            SET @sFecha_d = dbo.FechaSimple(@sFecha_d)
        IF @sFecha_h IS NOT NULL 
            SET @sFecha_h = dbo.FechaSimple(@sFecha_h)
  
        IF ( @sStatus IS NULL )
            SET @sStatus = 'T'
	
        IF @sAnulado IS NULL 
            SET @sAnulado = 'NOT'

        SELECT
            OP.ord_num,
			OP.cod_ben, 
			OP.fecha,
			OP.fec_pag,
			OP.anulado,
			OP.cod_cta,
			OP.cod_caja,
			OP.doc_num, 
			OP.co_mone,
			OPR.monto_d,
			OPR.monto_h,
		    OPR.monto_reten,
			OP.status,
			BE.ben_des,
			OP.Campo1,
			OP.Campo2,
			OP.Campo3,
			OP.Campo4,
			OP.Campo5,
			OP.Campo6,
			OP.Campo7,
			OP.Campo8
			
        FROM
            saOrdenPago AS OP
            INNER JOIN saOrdenPagoReng AS OPR ON OPR.ord_num = OP.ord_num
            INNER JOIN saBeneficiario AS BE ON BE.cod_ben = OP.cod_ben
        WHERE
            ( ( @sCo_Ord_d IS NULL
                OR OP.ord_num >= @sCo_Ord_d
              )
              AND ( @sCo_Ord_h IS NULL
                    OR OP.ord_num <= @sCo_Ord_h
                  )
            )
            AND ( @sFecha_d IS NULL
                  OR dbo.FechaSimple(OP.fecha) >= @sFecha_d
                )
            AND ( @sFecha_h IS NULL
                  OR dbo.FechaSimple(OP.fecha) <= @sFecha_h
                )
            AND ( ( @sCo_Ben_d IS NULL
                    OR OP.cod_ben >= @sCo_Ben_d
```
