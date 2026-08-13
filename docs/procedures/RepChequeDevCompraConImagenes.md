# SP: RepChequeDevCompraConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saChequeDevueltoCompra`](../tables/saChequeDevueltoCompra.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <21/01/2015>
-- Description:	<Generar cheque devuelto compra con imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepChequeDevCompraConImagenes]
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
	@sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
	@sCo_cta_d CHAR(6) = NULL ,
    @sCo_cta_h CHAR(6) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCo_Sucu CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

				Select CD.co_cheq_dev, CD.des_cheq_dev, P.co_prov, CD.fecha, CD.num_doc, CD.cod_cta, CD.co_tipo_doc, CD.nro_doc, 
				CD.mont_doc, CD.fec_cheq, CD.co_ban, CD.procesado, P.prov_des, B.des_ban,DI.co_imag, DI.des_imag, DI.picture, 
				TI.co_tipo_imag, TI.descrip as descripImagen  
				From saChequeDevueltoCompra as CD 
					left join saProveedor as P on CD.co_prov = P.co_prov
					left join saBanco as B on CD.co_ban = B.co_ban
					left outer join saDocumentoImagen DI 
					inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON CD.rowguid = DI.rowguidDoc
				WHERE
					  DI.co_imag is not null and
					  ( ( @cCo_Numero_d IS NULL
							OR CD.co_cheq_dev >= @cCo_Numero_d
							)
							AND ( @cCo_Numero_h IS NULL
								OR CD.co_cheq_dev <= @cCo_Numero_h
								)
						)
						AND ( ( @sCo_Prov_d IS NULL
							OR P.co_prov >= @sCo_Prov_d
						  )
						  AND ( @sCo_Prov_h IS NULL
								OR P.co_prov <= @sCo_Prov_h
							  )
						)
                        and ( ( @sCo_cta_d IS NULL
                            OR CD.cod_cta >= @sCo_cta_d
                          )
                          AND ( @sCo_cta_h IS NULL
                                OR CD.cod_cta <= @sCo_cta_h
                              )
                        )
                        AND ( ( @dFecha_d IS NULL
                                OR CD.fecha >= @dFecha_d
                              )
                              AND ( @dFecha_h IS NULL
                                    OR CD.fecha <= @dFecha_h
                                  )
                            )
```
