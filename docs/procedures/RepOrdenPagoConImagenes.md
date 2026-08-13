# SP: RepOrdenPagoConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <16-01-2015>
 Description:	<Reporte Ordenes de Pago Con Imagenes>
 =============================================*/
CREATE PROCEDURE [dbo].[RepOrdenPagoConImagenes]
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
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sAnulado CHAR(4) = NULL ,    
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
  
        IF @sStatus IS NULL 
            SET @sStatus = 'T'
	
        IF @sAnulado IS NULL 
            SET @sAnulado = 'NOT'

        SELECT
            OP.ord_num,	OP.cod_ben, OP.fecha,OP.fec_pag,OP.anulado,	OP.cod_cta,	OP.cod_caja,OP.doc_num, 
			OP.co_mone, OP.status,	BE.ben_des, MO.mone_des,
				DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen			
        FROM
            saOrdenPago AS OP
			left join saMoneda as MO on MO.co_mone = OP.co_mone
            INNER JOIN saBeneficiario AS BE ON BE.cod_ben = OP.cod_ben
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON OP.rowguid = DI.rowguidDoc
        WHERE
		DI.co_imag is not null and
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
            AND ( (
```
